import type { StreakCard } from '$lib/api';

/**
 * The card as it will look once today's completion is saved, so a tick shows at
 * once. Today is the last cell. The run grows or shrinks by one; the server's
 * numbers replace this when the refresh lands.
 */
export function withTodayDone(card: StreakCard, done: boolean): StreakCard {
	if (card.doneToday === done) return card;
	const current = Math.max(0, card.current + (done ? 1 : -1));
	const last = card.cells.length - 1;
	return {
		...card,
		doneToday: done,
		current,
		longest: Math.max(card.longest, current),
		cells: card.cells.map((cell, index) =>
			index === last ? { ...cell, state: done ? 'done' : 'pending' } : cell
		)
	};
}
