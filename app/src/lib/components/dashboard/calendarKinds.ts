import type { UpcomingKind } from '$lib/dashboard';

/** One color per kind of dated thing, shared by both calendar cards. */
export const KINDS: Record<UpcomingKind, { label: string; dot: string }> = {
	goal: { label: 'Goal', dot: 'bg-accent' },
	subgoal: { label: 'Subgoal', dot: 'bg-accent-secondary' },
	task: { label: 'Task', dot: 'bg-accent-tertiary' }
};
