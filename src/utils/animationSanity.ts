/**
 * Animation Sanity & Idempotency Manager
 * Prevents multiple network reloads, background refetches, and rapid re-renders
 * from confusing or restarting card entrance animations.
 */

// Tracks items that have already entered the UI during this session/context
const seenCardIds = new Set<string>();

/**
 * Returns whether a card with the given ID should animate on mount.
 * If the card has already been animated in this session, returns false so it renders stably.
 * If new, registers the ID and returns true.
 */
export function shouldAnimateCard(id?: string, enabled = true): boolean {
    if (!enabled || !id) return false;
    if (seenCardIds.has(id)) {
        return false;
    }
    seenCardIds.add(id);
    return true;
}

/**
 * Clear the seen cache when switching contexts (e.g., room switch, person switch)
 */
export function resetAnimationSanityRegistry(): void {
    seenCardIds.clear();
}
