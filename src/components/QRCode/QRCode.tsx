import React, { useMemo } from 'react';
import { generateQRMatrix } from '../../utils/qr';

export interface QRCodeProps {
    value: string;
    size?: number;
    className?: string;
    fgColor?: string;
    bgColor?: string;
}

export const QRCode: React.FC<QRCodeProps> = ({
    value,
    size = 180,
    className = '',
    fgColor = '#0b1c30',
    bgColor = '#ffffff',
}) => {
    const { path, moduleCount } = useMemo(() => {
        if (!value) return { path: '', moduleCount: 0 };
        try {
            const matrix = generateQRMatrix(value);
            const count = matrix.length;
            let d = '';
            for (let r = 0; r < count; r++) {
                for (let c = 0; c < count; c++) {
                    if (matrix[r][c]) {
                        d += `M${c + 2},${r + 2}h1v1h-1z `;
                    }
                }
            }
            return { path: d, moduleCount: count };
        } catch (err) {
            console.error('Failed to generate QR code', err);
            return { path: '', moduleCount: 0 };
        }
    }, [value]);

    if (!value || !path) {
        return (
            <div
                style={{ width: size, height: size }}
                className="flex items-center justify-center bg-surface-container rounded-2xl text-xs text-on-surface-variant font-mono"
            >
                Invalid QR
            </div>
        );
    }

    // Include 2-module quiet zone on each side
    const totalSize = moduleCount + 4;

    return (
        <svg
            viewBox={`0 0 ${totalSize} ${totalSize}`}
            width={size}
            height={size}
            className={`rounded-xl shadow-xs ${className}`}
            style={{ backgroundColor: bgColor }}
            shapeRendering="crispEdges"
        >
            <rect width={totalSize} height={totalSize} fill={bgColor} />
            <path d={path} fill={fgColor} />
        </svg>
    );
};

export default QRCode;

