/**
 * Triggers subtle vibration feedback on mobile devices that support navigator.vibrate.
 * Safely falls back on desktop / unsupported environments.
 */
export type HapticType = 'light' | 'medium' | 'success' | 'warning' | 'selection';

export const triggerHaptic = (type: HapticType = 'light'): void => {
    try {
        if (typeof window !== 'undefined' && 'navigator' in window && typeof navigator.vibrate === 'function') {
            switch (type) {
                case 'selection':
                case 'light':
                    navigator.vibrate(10);
                    break;
                case 'medium':
                    navigator.vibrate(20);
                    break;
                case 'success':
                    navigator.vibrate([15, 40, 20]);
                    break;
                case 'warning':
                    navigator.vibrate([35, 50, 35]);
                    break;
            }
        }
    } catch {
        // Silently ignore if blocked by browser policy
    }
};

export default triggerHaptic;

