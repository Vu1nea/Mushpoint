/** One colour per habit, so overlapping habits stay distinguishable. */
export const HABIT_COLORS = [
	{ bg: 'bg-accent-secondary', text: 'text-accent-secondary' },
	{ bg: 'bg-accent', text: 'text-accent-ink' },
	{ bg: 'bg-warn', text: 'text-warn' },
	{ bg: 'bg-danger', text: 'text-danger' },
	{ bg: 'bg-muted', text: 'text-muted' }
] as const;

export type HabitColor = (typeof HABIT_COLORS)[number];

/** The colour for a habit: its place among the recurring tasks, by id. The calendar
 * and the streak cards both use this, so a habit looks the same in each. */
export function habitColor(tasks: { id: number; recurrence: unknown }[], id: number): HabitColor {
	const ids = tasks
		.filter((task) => task.recurrence)
		.map((task) => task.id)
		.sort((a, b) => a - b);
	return HABIT_COLORS[Math.max(0, ids.indexOf(id)) % HABIT_COLORS.length];
}
