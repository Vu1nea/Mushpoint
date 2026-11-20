/** Ordering helpers for user-sorted lists (the vision board). Pure, so drag and
 * drop and the keyboard move buttons share one rule. */

/** `ids` with `sourceId` moved to where `targetId` is now, or null when nothing
 * would change. */
export function moveId(ids: number[], sourceId: number, targetId: number): number[] | null {
	const from = ids.indexOf(sourceId);
	const to = ids.indexOf(targetId);
	if (from < 0 || to < 0 || from === to) return null;
	const next = [...ids];
	next.splice(to, 0, ...next.splice(from, 1));
	return next;
}

/** `ids` with `id` swapped with its neighbour one step earlier (-1) or later (1),
 * or null at either end. */
export function moveIdBy(ids: number[], id: number, step: -1 | 1): number[] | null {
	const neighbour = ids[ids.indexOf(id) + step];
	return ids.includes(id) && neighbour !== undefined ? moveId(ids, id, neighbour) : null;
}
