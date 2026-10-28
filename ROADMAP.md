# 🚀 SplitNest Mobile UX & Feature Roadmap

This roadmap tracks the 6 key user friction improvements agreed upon for the project.

| # | Feature | Status | Description |
|---|---|---|---|
| 1 | **Join Trip QR on Header (Onboarding)** | ✅ Completed | Tap trip icon/title in header to open "Join Trip" modal with dynamic QR code & invite link. |
| 2 | **Creditor's "Collect via QR" (In-Person P2P)** | ✅ Completed | Creditor taps "QR" on debtor's card; displays creditor's pre-filled UPI QR for debtor to scan and 1-tap "Confirm Received". |
| 3 | **Consolidated Pairwise Payoff (Debt Clutter)** | ✅ Completed | Aggregates multiple splits between same debtor-creditor pair into a single net settle-up action with expandable breakdown. |
| 4 | **Shares / Weight Split Mode (Unequal Splits)** | ✅ Completed | `[-] [1x] [+]` steppers in AddPage for couples, kids, or unequal shares with penny-perfect distribution. |
| 5 | **Edit & Delete Splits (Mistake Recovery)** | ✅ Completed | Safe split deletion with creator/payer authorization and settlement protection guards. |
| 6 | **1-Tap Group WhatsApp Summary (Social Friction)** | ✅ Completed | Formatted group-level debt summary ready to paste into WhatsApp group chat. |

---

## Detailed Progress Log

### Step 1: Join Trip QR on Header (Onboarding)
- **Goal**: Allow any friend at airport / station to scan the header icon and immediately load the app & claim profile.
- **Components involved**: `src/components/Header/Header.tsx`, `src/components/Header/JoinTripModal.tsx`, `src/components/QRCode/QRCode.tsx`.
- **Status**: ✅ Completed & Verified.

### Step 2: Creditor's "Collect via QR" (In-Person P2P)
- **Goal**: Allow the creditor (who is owed money) to display a pre-filled UPI QR code directly on their phone screen for a debtor to scan in-person.
- **Components involved**:
  - `src/components/PaymentModal/CollectQrModal.tsx`: Bottom sheet modal with SVG QR code (`upi://pay?pa=...`), UPI ID clipboard copy, inline UPI ID updater if not yet configured, WhatsApp payment request link, and prominent 1-tap `[Confirm Received]`.
  - `src/pages/home/index.tsx`: Quick QR icon button on every settlement card.
  - `src/pages/splits/index.tsx`: QR trigger on active splits for creditor.
- **Status**: ✅ Completed & Verified.

### Step 3: Consolidated Pairwise Payoff (Debt Clutter)
- **Goal**: Consolidate multiple splits between the same debtor and creditor into a single net settle-up action, eliminating repetitive micro-transactions.
- **Components involved**:
  - `src/pages/home/index.tsx`:
    - Pairwise aggregation algorithm grouping debts by creditor (`to`) and debtor (`from`).
    - Consolidated cards displaying total owed across N splits (e.g. "Pay Bob ₹1,000 across 3 splits").
    - 1-Tap "Pay All" (debtor) and "Collect All QR" / "Confirm All" (creditor).
    - Expandable breakdown accordion showing individual split shares.
  - `src/components/PaymentModal/PaymentModal.tsx` & `CollectQrModal.tsx`: Support for batch `splitIds`.
- **Status**: ✅ Completed & Verified.

### Step 4: Shares / Weight Split Mode (Unequal Splits)
- **Goal**: Support couples (2x), kids (0.5x), non-drinkers (0x), or itemized weights without manual calculator gymnastics.
- **Components involved**:
  - `src/pages/add/index.tsx`: Segmented switcher (`Equal Split` vs `Shares / Weights`).
  - Stepper controls (`[-] [1x] [+]`) for each participant.
  - Real-time penny-perfect distribution calculation with remainder adjustments.
  - `src/api/types.ts` & `src/api/mutations.ts`: Payload support for `splitMode: 'CUSTOM'` and `customShares`.
  - Backend validation & calculation (`split.extension.js`): Fully supported.
- **Status**: ✅ Completed & Verified.

### Step 5: Edit & Delete Splits (Mistake Recovery)
- **Goal**: Allow creators/payers to edit details or delete mistaken splits while protecting accounting integrity.
- **Components involved**:
  - Backend:
    - `PUT /split/:id` in `index.js`, `updateSplit` in `helpers/extensions/split.extension.js`.
    - `DELETE /split/:id` in `index.js`, `deleteSplit` in `helpers/extensions/split.extension.js`.
    - Safety Guards:
      - Authorization: Only `createdBy` or `paidBy` can edit or delete.
      - Ledger Guard: If any share is `SETTLED`, split cannot be deleted, and amount/participants cannot be modified (description/category can still be updated). If all shares are `PENDING`, amount and participants are recalculated cleanly with penny-perfect rounding.
    - Unit tests: Added to `tests/split.test.js` (17/17 passing).
  - Frontend:
    - `useUpdateSplitMutation` and `useDeleteSplitMutation` in `src/api/mutations.ts` with optimistic cache updates.
    - `EditSplitModal` in `src/components/EditSplitModal/EditSplitModal.tsx`: Mobile bottom sheet with prefilled values, quick-increment chips, participant toggle, and live validation.
    - UI: Quick `[ ✏️ ]` icon button on split cards and `[Edit Split]` button alongside `[Delete Split]` in `src/pages/splits/index.tsx`.
- **Status**: ✅ Completed & Verified.

### Bonus / Foundation: Profile Switcher Modal Mobile Sheet & Scroll Fix
- **Goal**: Resolve profile switcher UX issues (sheet styling, list scrolling, and admin mode loop traps).
- **Components involved**:
  - `src/components/Header/ProfileModal.tsx`:
    - Converted to mobile bottom sheet (`items-end sm:items-center`, `rounded-t-3xl sm:rounded-2xl`, top drag handle).
    - Fixed list scrolling with `max-h-[55vh] overflow-y-auto overscroll-contain` and `e.stopPropagation()` on the dialog.
    - Separated active viewer switching from device profile claiming in Admin Mode (`[Set Owner]`, `[Unbind]`, `[Lock & Exit]`).
- **Status**: ✅ Completed & Verified.

### Step 6: 1-Tap Group WhatsApp Summary (Social Friction)
- **Goal**: Eliminate awkward 1-on-1 money badgering with a neutral, formatted group-level debt summary ready to paste into WhatsApp group chat.
- **Components involved**:
  - `src/pages/splits/index.tsx`: `handleShareGroupTripSummary` with pairwise aggregation of all pending settlements across the trip.
  - WhatsApp deep-link with formatted bold markdown (`*Bob* owes *₹700* to *Niraj* (UPI: ...)`), total spend, and web app link.
- **Status**: ✅ Completed & Verified.

