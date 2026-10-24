import React from 'react';

interface AvatarProps {
    name: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
}

const sizeClasses = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-xs',
    lg: 'w-11 h-11 text-sm',
    xl: 'w-14 h-14 text-base font-bold',
};

// Deterministic pastel color for avatars based on name
const colorPalette = [
    'bg-primary text-on-primary',
    'bg-secondary text-on-secondary',
    'bg-primary-container text-on-primary-container',
    'bg-secondary-container text-on-secondary-container',
    'bg-surface-container-highest text-primary font-bold',
];

export const Avatar: React.FC<AvatarProps> = ({
    name,
    size = 'md',
    className = '',
}) => {
    const initials = name
        ? name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .slice(0, 2)
              .toUpperCase()
        : '??';

    let charCodeSum = 0;
    for (let i = 0; i < (name || '').length; i++) {
        charCodeSum += name.charCodeAt(i);
    }
    const colorClass = colorPalette[charCodeSum % colorPalette.length];

    return (
        <div
            className={`rounded-full flex items-center justify-center font-semibold shrink-0 shadow-2xs ${colorClass} ${sizeClasses[size]} ${className}`}
        >
            {initials}
        </div>
    );
};

export default Avatar;
