/**
 * Robust date and category formatters for SplitNest transactions.
 */

export interface PurchaseTimeInfo {
    time: string; // e.g. "12:39 AM"
    date: string; // e.g. "Today", "Yesterday", "28 Oct"
    full: string; // e.g. "Today, 12:39 AM" or "28 Oct, 2:30 PM"
    raw: string;
    isToday: boolean;
    isYesterday: boolean;
}

export interface CategoryMeta {
    icon: string;
    bgClass: string;
    textClass: string;
}

/**
 * Parses timestamps in various formats (ISO-8601, YYYY-MM-DD HH:mm:ss, DD/MM/YYYY HH:mm:ss).
 */
export function parseCustomDate(dateStr?: string): Date | null {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const str = dateStr.trim();
    if (!str) return null;

    // 1. Try ISO 8601 directly if it includes 'T'
    if (str.includes('T')) {
        const d = new Date(str);
        if (!isNaN(d.getTime())) return d;
    }

    // 2. Try YYYY-MM-DD HH:mm:ss or YYYY/MM/DD
    const ymdMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
    if (ymdMatch) {
        const year = parseInt(ymdMatch[1], 10);
        const month = parseInt(ymdMatch[2], 10) - 1;
        const day = parseInt(ymdMatch[3], 10);
        const hour = ymdMatch[4] ? parseInt(ymdMatch[4], 10) : 0;
        const minute = ymdMatch[5] ? parseInt(ymdMatch[5], 10) : 0;
        const second = ymdMatch[6] ? parseInt(ymdMatch[6], 10) : 0;
        const d = new Date(year, month, day, hour, minute, second);
        if (!isNaN(d.getTime())) return d;
    }

    // 3. Try DD/MM/YYYY HH:mm:ss or DD-MM-YYYY
    const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
    if (dmyMatch) {
        const day = parseInt(dmyMatch[1], 10);
        const month = parseInt(dmyMatch[2], 10) - 1;
        const year = parseInt(dmyMatch[3], 10);
        const hour = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 0;
        const minute = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;
        const second = dmyMatch[6] ? parseInt(dmyMatch[6], 10) : 0;
        const d = new Date(year, month, day, hour, minute, second);
        if (!isNaN(d.getTime())) return d;
    }

    // Fallback standard constructor
    const fallback = new Date(str.replace(' ', 'T'));
    if (!isNaN(fallback.getTime())) return fallback;

    return null;
}

/**
 * Returns formatted time and date strings for transaction cards.
 */
export function formatPurchaseTime(dateStr?: string): PurchaseTimeInfo {
    if (!dateStr) {
        return {
            time: '',
            date: '',
            full: '',
            raw: '',
            isToday: false,
            isYesterday: false,
        };
    }

    const d = parseCustomDate(dateStr);
    if (!d) {
        return {
            time: '',
            date: dateStr,
            full: dateStr,
            raw: dateStr,
            isToday: false,
            isYesterday: false,
        };
    }

    const now = new Date();
    const isToday =
        d.getDate() === now.getDate() &&
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear();

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday =
        d.getDate() === yesterday.getDate() &&
        d.getMonth() === yesterday.getMonth() &&
        d.getFullYear() === yesterday.getFullYear();

    // Check if the original string contained time info (hour/min)
    const hasTimeComponent =
        dateStr.includes(':') || dateStr.includes('T') || (d.getHours() !== 0 || d.getMinutes() !== 0 || d.getSeconds() !== 0);

    const time = hasTimeComponent
        ? d.toLocaleTimeString('en-IN', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
          })
        : '';

    const date = isToday
        ? 'Today'
        : isYesterday
        ? 'Yesterday'
        : d.toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
          });

    const full = time ? `${date}, ${time}` : date;

    return {
        time,
        date,
        full,
        raw: dateStr,
        isToday,
        isYesterday,
    };
}

/**
 * Returns matching Material Symbol icon and tinted styling for categories.
 */
export function getCategoryMeta(category?: string): CategoryMeta {
    const c = (category || '').toLowerCase().trim();

    if (
        c.includes('food') ||
        c.includes('dine') ||
        c.includes('snack') ||
        c.includes('lunch') ||
        c.includes('dinner') ||
        c.includes('breakfast') ||
        c.includes('cafe') ||
        c.includes('tea') ||
        c.includes('chai')
    ) {
        return {
            icon: 'restaurant',
            bgClass: 'bg-amber-500/10',
            textClass: 'text-amber-600 dark:text-amber-400',
        };
    }

    if (c.includes('drink') || c.includes('water') || c.includes('bar') || c.includes('beverage') || c.includes('beer')) {
        return {
            icon: 'local_bar',
            bgClass: 'bg-cyan-500/10',
            textClass: 'text-cyan-600 dark:text-cyan-400',
        };
    }

    if (
        c.includes('travel') ||
        c.includes('cab') ||
        c.includes('taxi') ||
        c.includes('auto') ||
        c.includes('fuel') ||
        c.includes('petrol') ||
        c.includes('diesel') ||
        c.includes('toll') ||
        c.includes('flight') ||
        c.includes('train')
    ) {
        return {
            icon: 'directions_car',
            bgClass: 'bg-blue-500/10',
            textClass: 'text-blue-600 dark:text-blue-400',
        };
    }

    if (c.includes('stay') || c.includes('hotel') || c.includes('resort') || c.includes('room') || c.includes('camp') || c.includes('hostel')) {
        return {
            icon: 'hotel',
            bgClass: 'bg-purple-500/10',
            textClass: 'text-purple-600 dark:text-purple-400',
        };
    }

    if (
        c.includes('activity') ||
        c.includes('activities') ||
        c.includes('ski') ||
        c.includes('trek') ||
        c.includes('sport') ||
        c.includes('adventure') ||
        c.includes('paragliding') ||
        c.includes('rafting')
    ) {
        return {
            icon: 'snowboarding',
            bgClass: 'bg-emerald-500/10',
            textClass: 'text-emerald-600 dark:text-emerald-400',
        };
    }

    if (
        c.includes('shopping') ||
        c.includes('mall') ||
        c.includes('market') ||
        c.includes('groceries') ||
        c.includes('mart') ||
        c.includes('souvenir')
    ) {
        return {
            icon: 'shopping_bag',
            bgClass: 'bg-rose-500/10',
            textClass: 'text-rose-600 dark:text-rose-400',
        };
    }

    return {
        icon: 'receipt_long',
        bgClass: 'bg-primary/10',
        textClass: 'text-primary',
    };
}
