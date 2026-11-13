import React from 'react';
import { AppIcon } from '../Icon/AppIcon';

export interface RoomStatusBadgeProps {
    status?: 'ACTIVE' | 'ARCHIVED' | 'CLOSED' | 'active' | 'archived' | 'closed' | string;
    className?: string;
    size?: 'sm' | 'md';
}

export const RoomStatusBadge: React.FC<RoomStatusBadgeProps> = ({
    status = 'ACTIVE',
    className = '',
    size = 'md',
}) => {
    const normalized = String(status || 'ACTIVE').toUpperCase();

    const config = (() => {
        switch (normalized) {
            case 'ARCHIVED':
                return {
                    label: 'Archived',
                    icon: 'inventory_2',
                    classes:
                        'bg-tertiary/10 text-tertiary border-tertiary/25 hover:bg-tertiary/15',
                    dotClass: 'bg-tertiary',
                };
            case 'CLOSED':
                return {
                    label: 'Closed',
                    icon: 'lock',
                    classes:
                        'bg-surface-container-high text-on-surface-variant border-outline-variant/30 hover:bg-surface-container-highest',
                    dotClass: 'bg-outline',
                };
            case 'ACTIVE':
            default:
                return {
                    label: 'Active',
                    icon: 'check_circle',
                    classes:
                        'bg-primary/10 text-primary border-primary/20 hover:bg-primary/15',
                    dotClass: 'bg-primary',
                };
        }
    })();

    const sizeClasses =
        size === 'sm'
            ? 'text-[10px] px-2 py-0.5 gap-1'
            : 'text-xs px-2.5 py-1 gap-1.5 font-medium';

    return (
        <span
            className={`inline-flex items-center rounded-full border transition-colors ${config.classes} ${sizeClasses} ${className}`}
        >
            <span className={`w-1.5 h-1.5 rounded-full ${config.dotClass}`} />
            <AppIcon name={config.icon} className={size === 'sm' ? 'text-xs' : 'text-sm'} />
            <span>{config.label}</span>
        </span>
    );
};

export default RoomStatusBadge;

