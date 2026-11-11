import type { PersonDetail, Split } from '../api/types';

const ZERO_EPSILON = 0.01;

const round2 = (value: number): number => Math.round((Number(value) || 0) * 100) / 100;

export interface PairwiseSettlementRef {
    splitId: string;
    description: string;
    amount: number;
    from: string;
    to: string;
    direction: 'OWED_TO_ME' | 'I_OWE';
    toUpiId?: string | null;
    upiIntent?: string;
}

export interface NetReceivableGroup {
    from: string;
    netAmount: number;
    grossOwedToMe: number;
    grossIOwe: number;
    offsetAmount: number;
    hasMutualOffset: boolean;
    owedToMeSplits: PairwiseSettlementRef[];
    counterSplits: PairwiseSettlementRef[];
    allSplits: PairwiseSettlementRef[];
}

export interface NetPayableGroup {
    to: string;
    netAmount: number;
    grossIOwe: number;
    grossOwedToMe: number;
    offsetAmount: number;
    hasMutualOffset: boolean;
    toUpiId?: string | null;
    upiIntent?: string;
    youOweSplits: PairwiseSettlementRef[];
    counterSplits: PairwiseSettlementRef[];
    allSplits: PairwiseSettlementRef[];
}

export interface MutualZeroOffsetPair {
    counterparty: string;
    offsetAmount: number;
    owedToMeSplits: PairwiseSettlementRef[];
    youOweSplits: PairwiseSettlementRef[];
    allSplits: PairwiseSettlementRef[];
}

export interface CounterpartyPairwiseMeta {
    counterparty: string;
    theyOweYou: number;
    youOweThem: number;
    netSigned: number;
    offsetAmount: number;
    hasMutualOffset: boolean;
}

export interface PersonalPairwiseBalancesResult {
    receivables: NetReceivableGroup[];
    payables: NetPayableGroup[];
    mutualZeroOffsets: MutualZeroOffsetPair[];
    totalOwedToYou: number;
    totalYouOwe: number;
    netBalance: number;
    totalOffsetAmount: number;
    counterpartyLookup: Record<string, CounterpartyPairwiseMeta>;
}

export interface GroupPairwiseDebt {
    from: string;
    to: string;
    amount: number;
    grossFromTo: number;
    offsetAmount: number;
    hasMutualOffset: boolean;
    toUpiId?: string | null;
}

export interface GroupCancelledPair {
    personA: string;
    personB: string;
    offsetAmount: number;
}

export interface GroupPairwiseNetResult {
    pairs: GroupPairwiseDebt[];
    cancelledPairs: GroupCancelledPair[];
    rawPendingCount: number;
}

const buildCanonicalMap = (peopleDetails: PersonDetail[]) => {
    const canonicalNameMap = new Map<string, string>();
    const upiMap = new Map<string, string>();

    for (const p of peopleDetails) {
        const trimmed = p.name?.trim();
        if (!trimmed) continue;
        const key = trimmed.toLowerCase();
        canonicalNameMap.set(key, trimmed);
        if (p.upiId?.trim()) {
            upiMap.set(key, p.upiId.trim());
        }
    }

    return { canonicalNameMap, upiMap };
};

const extractUpiFromIntent = (upiIntent?: string): string | null => {
    if (!upiIntent) return null;
    try {
        const parsed = new URL(upiIntent);
        const pa = parsed.searchParams.get('pa');
        return pa?.trim() || null;
    } catch {
        const match = /[?&]pa=([^&]+)/i.exec(upiIntent);
        if (match && match[1]) {
            try {
                return decodeURIComponent(match[1]).trim() || null;
            } catch {
                return match[1].trim() || null;
            }
        }
        return null;
    }
};

/**
 * Computes pairwise-netted personal settlement balances for `activePerson`
 * across all active pending splits. Mutual dues between the same two people
 * cancel each other out cleanly (e.g. +50 and -50 -> ₹0, +150 and -50 -> +₹100 net).
 */
export function computePersonalPairwiseBalances(
    splits: Split[],
    activePerson: string,
    peopleDetails: PersonDetail[] = []
): PersonalPairwiseBalancesResult {
    const emptyResult: PersonalPairwiseBalancesResult = {
        receivables: [],
        payables: [],
        mutualZeroOffsets: [],
        totalOwedToYou: 0,
        totalYouOwe: 0,
        netBalance: 0,
        totalOffsetAmount: 0,
        counterpartyLookup: {},
    };

    const meTrimmed = activePerson?.trim();
    if (!meTrimmed) return emptyResult;
    const meLower = meTrimmed.toLowerCase();

    const { canonicalNameMap, upiMap } = buildCanonicalMap(peopleDetails);

    interface RawBucket {
        counterparty: string;
        theyOweYou: number;
        youOweThem: number;
        toUpiId: string | null;
        upiIntent?: string;
        owedToMeSplits: PairwiseSettlementRef[];
        youOweSplits: PairwiseSettlementRef[];
    }

    const buckets = new Map<string, RawBucket>();

    const ensureBucket = (rawOther: string): RawBucket => {
        const trimmed = rawOther.trim();
        const key = trimmed.toLowerCase();
        const canonical = canonicalNameMap.get(key) || trimmed;
        const existing = buckets.get(key);
        if (existing) return existing;

        const created: RawBucket = {
            counterparty: canonical,
            theyOweYou: 0,
            youOweThem: 0,
            toUpiId: upiMap.get(key) || null,
            upiIntent: undefined,
            owedToMeSplits: [],
            youOweSplits: [],
        };
        buckets.set(key, created);
        return created;
    };

    const activeSplits = splits.filter(
        (s) => (s.status || 'ACTIVE').toUpperCase() === 'ACTIVE'
    );

    for (const split of activeSplits) {
        for (const st of split.settlements || []) {
            if (!st || (st.status || 'PENDING').trim().toUpperCase() !== 'PENDING') continue;
            const amount = round2(st.amount);
            if (amount <= 0) continue;

            const fromTrimmed = st.from?.trim() || '';
            const toTrimmed = st.to?.trim() || '';
            const fromLower = fromTrimmed.toLowerCase();
            const toLower = toTrimmed.toLowerCase();

            if (!fromLower || !toLower || fromLower === toLower) continue;

            if (fromLower === meLower) {
                const bucket = ensureBucket(toTrimmed);
                const resolvedUpi =
                    st.toUpiId?.trim() ||
                    extractUpiFromIntent(st.upiIntent) ||
                    upiMap.get(toLower) ||
                    null;

                if (!bucket.toUpiId && resolvedUpi) {
                    bucket.toUpiId = resolvedUpi;
                }
                if (!bucket.upiIntent && st.upiIntent) {
                    bucket.upiIntent = st.upiIntent;
                }

                bucket.youOweThem = round2(bucket.youOweThem + amount);
                bucket.youOweSplits.push({
                    splitId: split.splitId,
                    description: split.description,
                    amount,
                    from: fromTrimmed,
                    to: toTrimmed,
                    direction: 'I_OWE',
                    toUpiId: resolvedUpi,
                    upiIntent: st.upiIntent,
                });
            } else if (toLower === meLower) {
                const bucket = ensureBucket(fromTrimmed);
                bucket.theyOweYou = round2(bucket.theyOweYou + amount);
                bucket.owedToMeSplits.push({
                    splitId: split.splitId,
                    description: split.description,
                    amount,
                    from: fromTrimmed,
                    to: toTrimmed,
                    direction: 'OWED_TO_ME',
                });
            }
        }
    }

    const receivables: NetReceivableGroup[] = [];
    const payables: NetPayableGroup[] = [];
    const mutualZeroOffsets: MutualZeroOffsetPair[] = [];
    const counterpartyLookup: Record<string, CounterpartyPairwiseMeta> = {};

    for (const [key, b] of buckets.entries()) {
        const grossOwedToMe = round2(b.theyOweYou);
        const grossIOwe = round2(b.youOweThem);
        const netSigned = round2(grossOwedToMe - grossIOwe);
        const offsetAmount = round2(Math.min(grossOwedToMe, grossIOwe));
        const hasMutualOffset = offsetAmount >= ZERO_EPSILON;
        const allSplits = [...b.owedToMeSplits, ...b.youOweSplits];

        counterpartyLookup[key] = {
            counterparty: b.counterparty,
            theyOweYou: grossOwedToMe,
            youOweThem: grossIOwe,
            netSigned: Math.abs(netSigned) < ZERO_EPSILON ? 0 : netSigned,
            offsetAmount,
            hasMutualOffset,
        };

        if (Math.abs(netSigned) < ZERO_EPSILON) {
            if (b.owedToMeSplits.length > 0 && b.youOweSplits.length > 0) {
                mutualZeroOffsets.push({
                    counterparty: b.counterparty,
                    offsetAmount,
                    owedToMeSplits: b.owedToMeSplits,
                    youOweSplits: b.youOweSplits,
                    allSplits,
                });
            }
        } else if (netSigned > 0) {
            receivables.push({
                from: b.counterparty,
                netAmount: netSigned,
                grossOwedToMe,
                grossIOwe,
                offsetAmount,
                hasMutualOffset,
                owedToMeSplits: b.owedToMeSplits,
                counterSplits: b.youOweSplits,
                allSplits,
            });
        } else {
            const absPayable = round2(Math.abs(netSigned));
            payables.push({
                to: b.counterparty,
                netAmount: absPayable,
                grossIOwe,
                grossOwedToMe,
                offsetAmount,
                hasMutualOffset,
                toUpiId: b.toUpiId,
                // Keep prebuilt intent only when 1 un-offset settlement matches exact amount
                upiIntent:
                    !hasMutualOffset && b.youOweSplits.length === 1
                        ? b.upiIntent
                        : undefined,
                youOweSplits: b.youOweSplits,
                counterSplits: b.owedToMeSplits,
                allSplits,
            });
        }
    }

    receivables.sort((a, b) => b.netAmount - a.netAmount);
    payables.sort((a, b) => b.netAmount - a.netAmount);
    mutualZeroOffsets.sort((a, b) => b.offsetAmount - a.offsetAmount);

    const totalOwedToYou = round2(receivables.reduce((sum, r) => sum + r.netAmount, 0));
    const totalYouOwe = round2(payables.reduce((sum, p) => sum + p.netAmount, 0));
    const netBalance = round2(totalOwedToYou - totalYouOwe);
    const totalOffsetAmount = round2(
        receivables.reduce((sum, r) => sum + r.offsetAmount, 0) +
            payables.reduce((sum, p) => sum + p.offsetAmount, 0) +
            mutualZeroOffsets.reduce((sum, m) => sum + m.offsetAmount, 0)
    );

    return {
        receivables,
        payables,
        mutualZeroOffsets,
        totalOwedToYou,
        totalYouOwe,
        netBalance,
        totalOffsetAmount,
        counterpartyLookup,
    };
}

/**
 * Computes group-wide pairwise-netted balances across every pair `(A, B)` in active splits.
 * Opposing pending dues cancel out so WhatsApp group debt summaries never contradict themselves.
 */
export function computeGroupPairwiseNetBalances(
    splits: Split[],
    peopleDetails: PersonDetail[] = []
): GroupPairwiseNetResult {
    const { canonicalNameMap, upiMap } = buildCanonicalMap(peopleDetails);

    interface PairAcc {
        keyA: string;
        keyB: string;
        nameA: string;
        nameB: string;
        grossAtoB: number;
        grossBtoA: number;
        upiB: string | null;
        upiA: string | null;
    }

    const pairMap = new Map<string, PairAcc>();
    let rawPendingCount = 0;

    const activeSplits = splits.filter(
        (s) => (s.status || 'ACTIVE').toUpperCase() === 'ACTIVE'
    );

    for (const split of activeSplits) {
        for (const st of split.settlements || []) {
            if (!st || (st.status || 'PENDING').trim().toUpperCase() !== 'PENDING') continue;
            const amount = round2(st.amount);
            if (amount <= 0) continue;

            const fromRaw = st.from?.trim() || '';
            const toRaw = st.to?.trim() || '';
            const fromLower = fromRaw.toLowerCase();
            const toLower = toRaw.toLowerCase();
            if (!fromLower || !toLower || fromLower === toLower) continue;

            rawPendingCount += 1;

            const fromName = canonicalNameMap.get(fromLower) || fromRaw;
            const toName = canonicalNameMap.get(toLower) || toRaw;

            const [keyA, keyB] =
                fromLower < toLower ? [fromLower, toLower] : [toLower, fromLower];
            const [nameA, nameB] =
                fromLower < toLower ? [fromName, toName] : [toName, fromName];
            const pairKey = `${keyA}::${keyB}`;

            let acc = pairMap.get(pairKey);
            if (!acc) {
                acc = {
                    keyA,
                    keyB,
                    nameA,
                    nameB,
                    grossAtoB: 0,
                    grossBtoA: 0,
                    upiB: upiMap.get(keyB) || null,
                    upiA: upiMap.get(keyA) || null,
                };
                pairMap.set(pairKey, acc);
            }

            const resolvedToUpi =
                st.toUpiId?.trim() ||
                extractUpiFromIntent(st.upiIntent) ||
                upiMap.get(toLower) ||
                null;

            if (fromLower === keyA) {
                acc.grossAtoB = round2(acc.grossAtoB + amount);
                if (!acc.upiB && resolvedToUpi) acc.upiB = resolvedToUpi;
            } else {
                acc.grossBtoA = round2(acc.grossBtoA + amount);
                if (!acc.upiA && resolvedToUpi) acc.upiA = resolvedToUpi;
            }
        }
    }

    const pairs: GroupPairwiseDebt[] = [];
    const cancelledPairs: GroupCancelledPair[] = [];

    for (const acc of pairMap.values()) {
        const netAtoB = round2(acc.grossAtoB - acc.grossBtoA);
        const offsetAmount = round2(Math.min(acc.grossAtoB, acc.grossBtoA));

        if (Math.abs(netAtoB) < ZERO_EPSILON) {
            cancelledPairs.push({
                personA: acc.nameA,
                personB: acc.nameB,
                offsetAmount,
            });
            continue;
        }

        if (netAtoB > 0) {
            pairs.push({
                from: acc.nameA,
                to: acc.nameB,
                amount: netAtoB,
                grossFromTo: acc.grossAtoB,
                offsetAmount,
                hasMutualOffset: offsetAmount >= ZERO_EPSILON,
                toUpiId: acc.upiB,
            });
        } else {
            pairs.push({
                from: acc.nameB,
                to: acc.nameA,
                amount: round2(Math.abs(netAtoB)),
                grossFromTo: acc.grossBtoA,
                offsetAmount,
                hasMutualOffset: offsetAmount >= ZERO_EPSILON,
                toUpiId: acc.upiA,
            });
        }
    }

    pairs.sort((a, b) => b.amount - a.amount);

    return { pairs, cancelledPairs, rawPendingCount };
}

