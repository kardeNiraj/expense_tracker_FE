/**
 * Pure TypeScript QR Code generator (zero external dependencies).
 * Based on Kazuhiko Arase's QR code algorithm (MIT License).
 * Capable of encoding alphanumeric/binary data into a 2D boolean matrix.
 */

// QR Error Correction Levels
export const QRErrorCorrectLevel = {
    L: 1,
    M: 0,
    Q: 3,
    H: 2,
} as const;

export type QRECCLevel = keyof typeof QRErrorCorrectLevel;

class QRMath {
    private static EXP_TABLE = new Array<number>(256);
    private static LOG_TABLE = new Array<number>(256);

    static {
        for (let i = 0; i < 8; i++) {
            QRMath.EXP_TABLE[i] = 1 << i;
        }
        for (let i = 8; i < 256; i++) {
            QRMath.EXP_TABLE[i] =
                QRMath.EXP_TABLE[i - 4] ^
                QRMath.EXP_TABLE[i - 5] ^
                QRMath.EXP_TABLE[i - 6] ^
                QRMath.EXP_TABLE[i - 8];
        }
        for (let i = 0; i < 255; i++) {
            QRMath.LOG_TABLE[QRMath.EXP_TABLE[i]] = i;
        }
    }

    public static glog(n: number): number {
        if (n < 1) throw new Error(`glog(${n})`);
        return QRMath.LOG_TABLE[n];
    }

    public static gexp(n: number): number {
        while (n < 0) n += 255;
        while (n >= 255) n -= 255;
        return QRMath.EXP_TABLE[n];
    }
}

class QRPolynomial {
    private num: number[];

    constructor(num: number[], shift = 0) {
        let offset = 0;
        while (offset < num.length && num[offset] === 0) {
            offset++;
        }
        this.num = new Array<number>(num.length - offset + shift);
        for (let i = 0; i < num.length - offset; i++) {
            this.num[i] = num[i + offset];
        }
        for (let i = num.length - offset; i < this.num.length; i++) {
            this.num[i] = 0;
        }
    }

    public get(index: number): number {
        return this.num[index];
    }

    public getLength(): number {
        return this.num.length;
    }

    public multiply(e: QRPolynomial): QRPolynomial {
        const num = new Array<number>(this.getLength() + e.getLength() - 1).fill(0);
        for (let i = 0; i < this.getLength(); i++) {
            for (let j = 0; j < e.getLength(); j++) {
                num[i + j] ^= QRMath.gexp(
                    QRMath.glog(this.get(i)) + QRMath.glog(e.get(j))
                );
            }
        }
        return new QRPolynomial(num);
    }

    public mod(e: QRPolynomial): QRPolynomial {
        if (this.getLength() - e.getLength() < 0) return this;
        const ratio = QRMath.glog(this.get(0)) - QRMath.glog(e.get(0));
        const num = new Array<number>(this.getLength());
        for (let i = 0; i < this.getLength(); i++) {
            num[i] = this.get(i);
        }
        for (let i = 0; i < e.getLength(); i++) {
            num[i] ^= QRMath.gexp(QRMath.glog(e.get(i)) + ratio);
        }
        return new QRPolynomial(num).mod(e);
    }
}

class QRRSBlock {
    public totalCount: number;
    public dataCount: number;

    constructor(totalCount: number, dataCount: number) {
        this.totalCount = totalCount;
        this.dataCount = dataCount;
    }

    private static RS_BLOCK_TABLE: number[][] = [
        // 1
        [1, 26, 19], [1, 26, 16], [1, 26, 13], [1, 26, 9],
        // 2
        [1, 44, 34], [1, 44, 28], [1, 44, 22], [1, 44, 16],
        // 3
        [1, 70, 55], [1, 70, 44], [2, 35, 17], [2, 35, 13],
        // 4
        [1, 100, 80], [2, 50, 32], [2, 50, 24], [4, 25, 9],
        // 5
        [1, 134, 108], [2, 67, 43], [2, 33, 15, 2, 34, 16], [2, 33, 11, 2, 34, 12],
        // 6
        [2, 86, 68], [4, 43, 27], [4, 43, 19], [4, 43, 15],
        // 7
        [2, 98, 78], [4, 49, 31], [2, 32, 14, 4, 33, 15], [4, 39, 13, 1, 40, 14],
        // 8
        [2, 121, 97], [2, 60, 38, 2, 61, 39], [4, 40, 18, 2, 41, 19], [4, 40, 14, 2, 41, 15],
        // 9
        [2, 146, 116], [3, 58, 36, 2, 59, 37], [4, 36, 16, 4, 37, 17], [4, 36, 12, 4, 37, 13],
        // 10
        [2, 86, 68, 2, 87, 69], [4, 69, 43, 1, 70, 44], [6, 43, 19, 2, 44, 20], [6, 43, 15, 2, 44, 16],
    ];

    public static getRSBlocks(typeNumber: number, errorCorrectLevel: number): QRRSBlock[] {
        const rsBlock = QRRSBlock.getRsBlockTable(typeNumber, errorCorrectLevel);
        if (!rsBlock) {
            throw new Error(`bad rs block @ typeNumber:${typeNumber}/errorCorrectLevel:${errorCorrectLevel}`);
        }
        const length = rsBlock.length / 3;
        const list: QRRSBlock[] = [];
        for (let i = 0; i < length; i++) {
            const count = rsBlock[i * 3 + 0];
            const totalCount = rsBlock[i * 3 + 1];
            const dataCount = rsBlock[i * 3 + 2];
            for (let j = 0; j < count; j++) {
                list.push(new QRRSBlock(totalCount, dataCount));
            }
        }
        return list;
    }

    private static getRsBlockTable(typeNumber: number, errorCorrectLevel: number): number[] | undefined {
        switch (errorCorrectLevel) {
            case QRErrorCorrectLevel.L: return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 0];
            case QRErrorCorrectLevel.M: return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 1];
            case QRErrorCorrectLevel.Q: return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 2];
            case QRErrorCorrectLevel.H: return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 3];
            default: return undefined;
        }
    }
}

class QRBitBuffer {
    public buffer: number[] = [];
    public length = 0;

    public get(index: number): boolean {
        const bufIndex = Math.floor(index / 8);
        return ((this.buffer[bufIndex] >>> (7 - (index % 8))) & 1) === 1;
    }

    public put(num: number, length: number): void {
        for (let i = 0; i < length; i++) {
            this.putBit(((num >>> (length - i - 1)) & 1) === 1);
        }
    }

    public putBit(bit: boolean): void {
        const bufIndex = Math.floor(this.length / 8);
        if (this.buffer.length <= bufIndex) {
            this.buffer.push(0);
        }
        if (bit) {
            this.buffer[bufIndex] |= 0x80 >>> (this.length % 8);
        }
        this.length++;
    }
}

export class QRCode {
    private typeNumber: number;
    private errorCorrectLevel: number;
    private modules: (boolean | null)[][] = [];
    private moduleCount = 0;
    private dataList: { mode: number; data: string }[] = [];

    constructor(typeNumber = 0, errorCorrectLevel: number = QRErrorCorrectLevel.M) {
        this.typeNumber = typeNumber;
        this.errorCorrectLevel = errorCorrectLevel;
    }

    public addData(data: string): void {
        this.dataList.push({ mode: 4 /* 8bit byte */, data });
    }

    public isDark(row: number, col: number): boolean {
        if (row < 0 || this.moduleCount <= row || col < 0 || this.moduleCount <= col) {
            throw new Error(`${row},${col}`);
        }
        return !!this.modules[row][col];
    }

    public getModuleCount(): number {
        return this.moduleCount;
    }

    public make(): void {
        if (this.typeNumber < 1) {
            let typeNumber = 1;
            for (; typeNumber <= 10; typeNumber++) {
                const rsBlocks = QRRSBlock.getRSBlocks(typeNumber, this.errorCorrectLevel);
                const buffer = new QRBitBuffer();
                let totalData = 0;
                for (let i = 0; i < rsBlocks.length; i++) {
                    totalData += rsBlocks[i].dataCount;
                }
                for (let i = 0; i < this.dataList.length; i++) {
                    const data = this.dataList[i];
                    buffer.put(data.mode, 4);
                    buffer.put(data.data.length, typeNumber < 10 ? 8 : 16);
                    for (let j = 0; j < data.data.length; j++) {
                        buffer.put(data.data.charCodeAt(j), 8);
                    }
                }
                if (buffer.length <= totalData * 8) {
                    break;
                }
            }
            this.typeNumber = typeNumber;
        }
        this.makeImpl(false, this.getBestMaskPattern());
    }

    private makeImpl(test: boolean, maskPattern: number): void {
        this.moduleCount = this.typeNumber * 4 + 17;
        this.modules = new Array(this.moduleCount);
        for (let row = 0; row < this.moduleCount; row++) {
            this.modules[row] = new Array(this.moduleCount).fill(null);
        }

        this.setupPositionProbePattern(0, 0);
        this.setupPositionProbePattern(this.moduleCount - 7, 0);
        this.setupPositionProbePattern(0, this.moduleCount - 7);
        this.setupPositionAdjustPattern();
        this.setupTimingPattern();
        this.setupTypeInfo(test, maskPattern);

        if (this.typeNumber >= 7) {
            this.setupTypeNumber(test);
        }

        const data = this.createData(this.typeNumber, this.errorCorrectLevel, this.dataList);
        this.mapData(data, maskPattern);
    }

    private setupPositionProbePattern(row: number, col: number): void {
        for (let r = -1; r <= 7; r++) {
            if (row + r <= -1 || this.moduleCount <= row + r) continue;
            for (let c = -1; c <= 7; c++) {
                if (col + c <= -1 || this.moduleCount <= col + c) continue;
                if (
                    (0 <= r && r <= 6 && (c === 0 || c === 6)) ||
                    (0 <= c && c <= 6 && (r === 0 || r === 6)) ||
                    (2 <= r && r <= 4 && 2 <= c && c <= 4)
                ) {
                    this.modules[row + r][col + c] = true;
                } else {
                    this.modules[row + r][col + c] = false;
                }
            }
        }
    }

    private getBestMaskPattern(): number {
        let minLostPoint = 0;
        let pattern = 0;
        for (let i = 0; i < 8; i++) {
            this.makeImpl(true, i);
            const lostPoint = this.getLostPoint();
            if (i === 0 || minLostPoint > lostPoint) {
                minLostPoint = lostPoint;
                pattern = i;
            }
        }
        return pattern;
    }

    private setupTimingPattern(): void {
        for (let r = 8; r < this.moduleCount - 8; r++) {
            if (this.modules[r][6] !== null) continue;
            this.modules[r][6] = r % 2 === 0;
        }
        for (let c = 8; c < this.moduleCount - 8; c++) {
            if (this.modules[6][c] !== null) continue;
            this.modules[6][c] = c % 2 === 0;
        }
    }

    private setupPositionAdjustPattern(): void {
        const pos = this.getPatternPosition(this.typeNumber);
        for (let i = 0; i < pos.length; i++) {
            for (let j = 0; j < pos.length; j++) {
                const row = pos[i];
                const col = pos[j];
                if (this.modules[row][col] !== null) continue;
                for (let r = -2; r <= 2; r++) {
                    for (let c = -2; c <= 2; c++) {
                        if (
                            r === -2 ||
                            r === 2 ||
                            c === -2 ||
                            c === 2 ||
                            (r === 0 && c === 0)
                        ) {
                            this.modules[row + r][col + c] = true;
                        } else {
                            this.modules[row + r][col + c] = false;
                        }
                    }
                }
            }
        }
    }

    private getPatternPosition(typeNumber: number): number[] {
        switch (typeNumber) {
            case 2: return [6, 18];
            case 3: return [6, 22];
            case 4: return [6, 26];
            case 5: return [6, 30];
            case 6: return [6, 34];
            case 7: return [6, 22, 38];
            case 8: return [6, 24, 42];
            case 9: return [6, 26, 46];
            case 10: return [6, 28, 50];
            default: return [];
        }
    }

    private setupTypeNumber(test: boolean): void {
        const bits = this.getBCHTypeNumber(this.typeNumber);
        for (let i = 0; i < 18; i++) {
            const mod = !test && ((bits >> i) & 1) === 1;
            this.modules[Math.floor(i / 3)][(i % 3) + this.moduleCount - 8 - 3] = mod;
            this.modules[(i % 3) + this.moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
        }
    }

    private setupTypeInfo(test: boolean, maskPattern: number): void {
        const data = (this.errorCorrectLevel << 3) | maskPattern;
        const bits = this.getBCHTypeInfo(data);
        for (let i = 0; i < 15; i++) {
            const mod = !test && ((bits >> i) & 1) === 1;
            if (i < 6) {
                this.modules[i][8] = mod;
            } else if (i < 8) {
                this.modules[i + 1][8] = mod;
            } else {
                this.modules[this.moduleCount - 15 + i][8] = mod;
            }
            if (i < 8) {
                this.modules[8][this.moduleCount - i - 1] = mod;
            } else if (i < 9) {
                this.modules[8][15 - i - 1 + 1] = mod;
            } else {
                this.modules[8][15 - i - 1] = mod;
            }
        }
        this.modules[this.moduleCount - 8][8] = !test;
    }

    private mapData(data: number[], maskPattern: number): void {
        let inc = -1;
        let row = this.moduleCount - 1;
        let bitIndex = 7;
        let byteIndex = 0;

        for (let col = this.moduleCount - 1; col > 0; col -= 2) {
            if (col === 6) col--;
            while (true) {
                for (let c = 0; c < 2; c++) {
                    if (this.modules[row][col - c] === null) {
                        let dark = false;
                        if (byteIndex < data.length) {
                            dark = ((data[byteIndex] >>> bitIndex) & 1) === 1;
                        }
                        const mask = this.getMask(maskPattern, row, col - c);
                        if (mask) dark = !dark;
                        this.modules[row][col - c] = dark;
                        bitIndex--;
                        if (bitIndex === -1) {
                            byteIndex++;
                            bitIndex = 7;
                        }
                    }
                }
                row += inc;
                if (row < 0 || this.moduleCount <= row) {
                    row -= inc;
                    inc = -inc;
                    break;
                }
            }
        }
    }

    private getMask(maskPattern: number, i: number, j: number): boolean {
        switch (maskPattern) {
            case 0: return (i + j) % 2 === 0;
            case 1: return i % 2 === 0;
            case 2: return j % 3 === 0;
            case 3: return (i + j) % 3 === 0;
            case 4: return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0;
            case 5: return ((i * j) % 2) + ((i * j) % 3) === 0;
            case 6: return (((i * j) % 2) + ((i * j) % 3)) % 2 === 0;
            case 7: return (((i * j) % 3) + ((i + j) % 2)) % 2 === 0;
            default: throw new Error(`bad maskPattern:${maskPattern}`);
        }
    }

    private createData(typeNumber: number, errorCorrectLevel: number, dataList: { mode: number; data: string }[]): number[] {
        const rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectLevel);
        const buffer = new QRBitBuffer();
        for (let i = 0; i < dataList.length; i++) {
            const data = dataList[i];
            buffer.put(data.mode, 4);
            buffer.put(data.data.length, typeNumber < 10 ? 8 : 16);
            for (let j = 0; j < data.data.length; j++) {
                buffer.put(data.data.charCodeAt(j), 8);
            }
        }

        let totalDataCount = 0;
        for (let i = 0; i < rsBlocks.length; i++) {
            totalDataCount += rsBlocks[i].dataCount;
        }

        if (buffer.length + 4 <= totalDataCount * 8) {
            buffer.put(0, 4);
        }
        while (buffer.length % 8 !== 0) {
            buffer.putBit(false);
        }

        while (true) {
            if (buffer.length >= totalDataCount * 8) break;
            buffer.put(0xec, 8);
            if (buffer.length >= totalDataCount * 8) break;
            buffer.put(0x11, 8);
        }

        return this.createBytes(buffer, rsBlocks);
    }

    private createBytes(buffer: QRBitBuffer, rsBlocks: QRRSBlock[]): number[] {
        let offset = 0;
        let maxDcCount = 0;
        let maxEcCount = 0;
        const dcdata: number[][] = new Array(rsBlocks.length);
        const ecdata: number[][] = new Array(rsBlocks.length);

        for (let r = 0; r < rsBlocks.length; r++) {
            const dcCount = rsBlocks[r].dataCount;
            const ecCount = rsBlocks[r].totalCount - dcCount;
            maxDcCount = Math.max(maxDcCount, dcCount);
            maxEcCount = Math.max(maxEcCount, ecCount);

            dcdata[r] = new Array(dcCount);
            for (let i = 0; i < dcdata[r].length; i++) {
                dcdata[r][i] = 0xff & buffer.buffer[i + offset];
            }
            offset += dcCount;

            const rsPoly = this.getErrorCorrectPolynomial(ecCount);
            const rawPoly = new QRPolynomial(dcdata[r], rsPoly.getLength() - 1);
            const modPoly = rawPoly.mod(rsPoly);
            ecdata[r] = new Array(rsPoly.getLength() - 1);
            for (let i = 0; i < ecdata[r].length; i++) {
                const modIndex = i + modPoly.getLength() - ecdata[r].length;
                ecdata[r][i] = modIndex >= 0 ? modPoly.get(modIndex) : 0;
            }
        }

        const data: number[] = [];
        for (let i = 0; i < maxDcCount; i++) {
            for (let r = 0; r < rsBlocks.length; r++) {
                if (i < dcdata[r].length) data.push(dcdata[r][i]);
            }
        }
        for (let i = 0; i < maxEcCount; i++) {
            for (let r = 0; r < rsBlocks.length; r++) {
                if (i < ecdata[r].length) data.push(ecdata[r][i]);
            }
        }
        return data;
    }

    private getErrorCorrectPolynomial(errorCorrectLength: number): QRPolynomial {
        let a = new QRPolynomial([1], 0);
        for (let i = 0; i < errorCorrectLength; i++) {
            a = a.multiply(new QRPolynomial([1, QRMath.gexp(i)], 0));
        }
        return a;
    }

    private getBCHTypeInfo(data: number): number {
        let d = data << 10;
        while (this.getBCHDigit(d) - this.getBCHDigit(1335) >= 0) {
            d ^= 1335 << (this.getBCHDigit(d) - this.getBCHDigit(1335));
        }
        return ((data << 10) | d) ^ 21522;
    }

    private getBCHTypeNumber(data: number): number {
        let d = data << 12;
        while (this.getBCHDigit(d) - this.getBCHDigit(7973) >= 0) {
            d ^= 7973 << (this.getBCHDigit(d) - this.getBCHDigit(7973));
        }
        return (data << 12) | d;
    }

    private getBCHDigit(data: number): number {
        let digit = 0;
        while (data !== 0) {
            digit++;
            data >>>= 1;
        }
        return digit;
    }

    private getLostPoint(): number {
        const moduleCount = this.moduleCount;
        let lostPoint = 0;

        for (let row = 0; row < moduleCount; row++) {
            for (let col = 0; col < moduleCount; col++) {
                let sameCount = 0;
                const dark = this.modules[row][col];
                for (let r = -1; r <= 1; r++) {
                    if (row + r < 0 || moduleCount <= row + r) continue;
                    for (let c = -1; c <= 1; c++) {
                        if (col + c < 0 || moduleCount <= col + c) continue;
                        if (r === 0 && c === 0) continue;
                        if (dark === this.modules[row + r][col + c]) sameCount++;
                    }
                }
                if (sameCount > 5) lostPoint += 3 + sameCount - 5;
            }
        }

        return lostPoint;
    }
}

/**
 * Returns a 2D boolean matrix representing the QR modules.
 */
export function generateQRMatrix(text: string): boolean[][] {
    const qr = new QRCode(0, QRErrorCorrectLevel.M);
    qr.addData(text);
    qr.make();
    const count = qr.getModuleCount();
    const matrix: boolean[][] = [];
    for (let r = 0; r < count; r++) {
        const row: boolean[] = [];
        for (let c = 0; c < count; c++) {
            row.push(qr.isDark(r, c));
        }
        matrix.push(row);
    }
    return matrix;
}

export interface BuildUpiPaymentUriOptions {
    upiId?: string | null;
    payeeName?: string;
    amount?: number;
    note?: string;
    includeAmount?: boolean;
}

/**
 * Builds a clean, NPCI-compatible `upi://pay?...` URI for QR rendering.
 */
export function buildUpiPaymentUri({
    upiId,
    payeeName,
    amount,
    note,
    includeAmount = true,
}: BuildUpiPaymentUriOptions): string {
    const cleanUpi = (upiId || '').trim();
    if (!cleanUpi) return '';

    const cleanName = (payeeName || 'Payee')
        .replace(/[^\x20-\x7E]/g, ' ')
        .trim()
        .slice(0, 40) || 'Payee';

    const cleanNote = (note || 'SplitNest Payment')
        .replace(/[^\x20-\x7E]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 30);

    const params: string[] = [
        `pa=${encodeURIComponent(cleanUpi)}`,
        `pn=${encodeURIComponent(cleanName)}`,
    ];

    if (includeAmount && typeof amount === 'number' && Number.isFinite(amount) && amount > 0) {
        const rounded = Math.round(amount * 100) / 100;
        params.push(`am=${encodeURIComponent(String(rounded))}`);
    }

    params.push('cu=INR');

    if (cleanNote) {
        params.push(`tn=${encodeURIComponent(cleanNote)}`);
    }

    return `upi://pay?${params.join('&')}`;
}

export interface ParsedUpiQr {
    raw: string;
    upiId: string;
    payeeName?: string;
    amount?: number;
    note?: string;
    currency?: string;
}

const VPA_REGEX = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+$/;

/**
 * Parses a scanned UPI QR payload (`upi://pay?...`) or bare UPI VPA (`user@bank`).
 * Returns null if the scanned text does not contain a valid UPI address.
 */
export function parseUpiQrPayload(rawText: string): ParsedUpiQr | null {
    const trimmed = rawText.trim();
    if (!trimmed) return null;

    const lower = trimmed.toLowerCase();
    if (lower.startsWith('upi://') || lower.includes('pa=')) {
        const queryIdx = trimmed.indexOf('?');
        const queryStr = queryIdx >= 0 ? trimmed.slice(queryIdx + 1) : trimmed;
        try {
            const params = new URLSearchParams(queryStr);
            const pa = (params.get('pa') || '').trim();
            if (!pa || !VPA_REGEX.test(pa)) {
                return null;
            }
            const pn = params.get('pn')?.trim() || undefined;
            const amRaw = params.get('am')?.trim();
            const amNum = amRaw ? Number(amRaw) : NaN;
            const amount = Number.isFinite(amNum) && amNum > 0 ? Math.round(amNum * 100) / 100 : undefined;
            const note = params.get('tn')?.trim() || params.get('tr')?.trim() || undefined;
            const currency = params.get('cu')?.trim() || undefined;

            return {
                raw: trimmed,
                upiId: pa,
                payeeName: pn,
                amount,
                note,
                currency,
            };
        } catch {
            return null;
        }
    }

    if (VPA_REGEX.test(trimmed)) {
        return {
            raw: buildUpiPaymentUri({ upiId: trimmed }),
            upiId: trimmed,
        };
    }

    return null;
}

export interface RenderUpiQrCardOptions {
    value: string;
    title: string;
    subtitle?: string;
    amountLabel?: string;
    upiId?: string;
    payerLabel?: string;
}

function drawRoundedRectPath(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
): void {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
}

/**
 * Renders a shareable high-contrast PNG payment QR card via Canvas.
 * Keeping generous white quiet zone around modules ensures reliable
 * "Scan from Gallery" detection in Google Pay, PhonePe, Paytm, and BHIM.
 */
export async function renderUpiQrCardToPngBlob({
    value,
    title,
    subtitle,
    amountLabel,
    upiId,
    payerLabel,
}: RenderUpiQrCardOptions): Promise<Blob> {
    if (!value) {
        throw new Error('QR value is required');
    }

    const matrix = generateQRMatrix(value);
    const moduleCount = matrix.length;

    const width = 640;
    const height = 780;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('Canvas 2D context unavailable');
    }

    // Crisp white canvas background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Subtle header accent bar
    ctx.fillStyle = '#065f46';
    ctx.fillRect(0, 0, width, 14);

    // Header label
    ctx.textAlign = 'center';
    ctx.fillStyle = '#065f46';
    ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
    ctx.fillText('SPLITNEST UPI PAY', width / 2, 46);

    const cleanPayerLabel = payerLabel?.trim();
    let cursorY = 92;

    if (cleanPayerLabel) {
        const pillText = cleanPayerLabel.slice(0, 30).toUpperCase();
        ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
        const pillWidth = Math.min(width - 80, Math.max(220, ctx.measureText(pillText).width + 52));
        const pillX = (width - pillWidth) / 2;
        const pillY = 60;
        const pillHeight = 38;

        drawRoundedRectPath(ctx, pillX, pillY, pillWidth, pillHeight, 19);
        ctx.fillStyle = '#ecfdf5';
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#6ee7b7';
        ctx.stroke();

        ctx.fillStyle = '#065f46';
        ctx.fillText(pillText, width / 2, pillY + 26, pillWidth - 24);

        cursorY = 136;
    }

    // Payee / Title
    ctx.fillStyle = '#0f172a';
    ctx.font = cleanPayerLabel
        ? 'bold 27px system-ui, -apple-system, sans-serif'
        : 'bold 30px system-ui, -apple-system, sans-serif';
    ctx.fillText(title.slice(0, 34), width / 2, cursorY, width - 64);

    // Optional amount & QR box vertical positioning
    let qrTopY = cleanPayerLabel ? 158 : 118;
    if (amountLabel) {
        ctx.fillStyle = '#047857';
        ctx.font = 'bold 34px ui-monospace, SFMono-Regular, monospace';
        ctx.fillText(amountLabel, width / 2, cursorY + 42, width - 64);
        qrTopY = cursorY + 62;
    } else if (subtitle) {
        ctx.fillStyle = '#475569';
        ctx.font = '500 20px system-ui, -apple-system, sans-serif';
        ctx.fillText(subtitle.slice(0, 44), width / 2, cursorY + 38, width - 64);
        qrTopY = cursorY + 58;
    }

    // Generous white quiet-zone box around QR code
    const qrBoxSize = 412;
    const qrBoxX = (width - qrBoxSize) / 2;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(qrBoxX, qrTopY, qrBoxSize, qrBoxSize);

    const quietModules = 4;
    const totalModules = moduleCount + quietModules * 2;
    const cellSize = Math.floor(qrBoxSize / totalModules);
    const renderedQrSize = cellSize * moduleCount;
    const originX = Math.floor((width - renderedQrSize) / 2);
    const originY = Math.floor(qrTopY + (qrBoxSize - renderedQrSize) / 2);

    ctx.fillStyle = '#0b1c30';
    for (let r = 0; r < moduleCount; r++) {
        for (let c = 0; c < moduleCount; c++) {
            if (matrix[r][c]) {
                ctx.fillRect(
                    originX + c * cellSize,
                    originY + r * cellSize,
                    cellSize,
                    cellSize
                );
            }
        }
    }

    // UPI ID, split subtitle & scan instruction footer
    let footerCursorY = qrTopY + qrBoxSize + 30;
    if (upiId) {
        ctx.fillStyle = '#1e293b';
        ctx.font = '600 21px ui-monospace, SFMono-Regular, monospace';
        ctx.fillText(upiId, width / 2, footerCursorY, width - 64);
        footerCursorY += 32;
    }

    if (subtitle && amountLabel) {
        ctx.fillStyle = '#475569';
        ctx.font = '500 18px system-ui, -apple-system, sans-serif';
        ctx.fillText(subtitle.slice(0, 48), width / 2, footerCursorY, width - 64);
        footerCursorY += 30;
    }

    ctx.fillStyle = '#64748b';
    ctx.font = '500 16px system-ui, -apple-system, sans-serif';
    ctx.fillText(
        'Save QR & scan in PhonePe, GPay, Paytm, or BHIM',
        width / 2,
        Math.min(height - 20, footerCursorY),
        width - 64
    );

    return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) {
                resolve(blob);
            } else {
                reject(new Error('Failed to export QR card as PNG'));
            }
        }, 'image/png');
    });
}

function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                resolve(reader.result);
            } else {
                reject(new Error('Failed to encode QR image'));
            }
        };
        reader.onerror = () => reject(reader.error || new Error('Failed to read QR blob'));
        reader.readAsDataURL(blob);
    });
}

export interface QrCardShareItem {
    blob: Blob;
    fileName: string;
}

/**
 * Triggers browser PNG downloads for one or more QR cards cleanly.
 */
export async function downloadQrCards(items: QrCardShareItem[]): Promise<void> {
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const dataUrl = await blobToDataUrl(item.blob);
        const anchor = document.createElement('a');
        anchor.href = dataUrl;
        anchor.download = item.fileName;
        anchor.rel = 'noopener noreferrer';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();

        if (i < items.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 140));
        }
    }
}

/**
 * Shares one or multiple prepared QR card `File` objects synchronously on click
 * (preserving WebKit/Safari transient user activation), with multi-file download fallback.
 */
export async function shareQrCardFiles({
    files,
    title,
    text,
    fallbackItems,
}: {
    files: File[];
    title: string;
    text?: string;
    fallbackItems?: QrCardShareItem[];
}): Promise<'shared' | 'shared_files_only' | 'downloaded' | 'cancelled'> {
    if (files.length === 0) {
        return 'cancelled';
    }

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        const candidates: { data: ShareData; result: 'shared' | 'shared_files_only' }[] = [
            {
                data: {
                    files,
                    title,
                    ...(text ? { text } : {}),
                },
                result: 'shared',
            },
            {
                data: {
                    files,
                    title,
                },
                result: text ? 'shared_files_only' : 'shared',
            },
            {
                data: {
                    files,
                },
                result: text ? 'shared_files_only' : 'shared',
            },
        ];

        for (const candidate of candidates) {
            const canShare =
                typeof navigator.canShare === 'function'
                    ? navigator.canShare(candidate.data)
                    : true;
            if (!canShare) continue;

            try {
                await navigator.share(candidate.data);
                return candidate.result;
            } catch (err) {
                if (err instanceof DOMException && err.name === 'AbortError') {
                    return 'cancelled';
                }
                // Try simpler payload shape or download fallback on Web Share rejection
            }
        }
    }

    await downloadQrCards(
        fallbackItems || files.map((file) => ({ blob: file, fileName: file.name }))
    );
    return 'downloaded';
}

/**
 * Shares the PNG QR card via Web Share API (best on iOS/Android to send/save to Photos/UPI apps),
 * falling back to direct PNG file download on browsers without file-share support.
 */
export async function shareOrDownloadQrCard(
    blob: Blob,
    fileName: string,
    title: string,
    text?: string
): Promise<'shared' | 'downloaded' | 'cancelled'> {
    const file = new File([blob], fileName, { type: 'image/png' });
    const outcome = await shareQrCardFiles({
        files: [file],
        title,
        text,
        fallbackItems: [{ blob, fileName }],
    });
    return outcome === 'shared_files_only' ? 'shared' : outcome;
}
