import React from 'react';
import { ALT_VIEWBOX_ICONS, ICON_PATHS } from './iconPaths';

export interface AppIconProps {
    name?: string | null;
    className?: string;
    style?: React.CSSProperties;
    title?: string;
}

const ICON_ALIASES: Record<string, string> = {
    cloud_queue: 'cloud',
    help_outline: 'help',
    terrain: 'filter_hdr',
};

const FALLBACK_ICON_NAME = 'receipt_long';
const DEFAULT_VIEWBOX = '0 -960 960 960';

export const AppIcon: React.FC<AppIconProps> = ({ name, className = '', style, title }) => {
    const rawName = typeof name === 'string' ? name.trim() : '';
    const resolvedName = ICON_ALIASES[rawName] || rawName;
    const altIcon = ALT_VIEWBOX_ICONS[resolvedName];
    const d = altIcon?.d || ICON_PATHS[resolvedName] || ICON_PATHS[FALLBACK_ICON_NAME];
    const viewBox = altIcon?.viewBox || DEFAULT_VIEWBOX;

    return (
        <svg
            viewBox={viewBox}
            fill="currentColor"
            style={style}
            className={`inline-block w-[1em] h-[1em] shrink-0 select-none align-middle ${className}`.trim()}
            aria-hidden={title ? undefined : true}
            role={title ? 'img' : undefined}
            focusable="false"
        >
            {title ? <title>{title}</title> : null}
            <path d={d} />
        </svg>
    );
};

export default AppIcon;

