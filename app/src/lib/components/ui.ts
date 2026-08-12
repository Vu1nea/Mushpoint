/**
 * Goal-tracker-specific styling that doesn't belong in the shared design
 * package. Everything else (button/chip/segment/field/sectionHeading/lift)
 * re-exports from `mushpoint-design/utils/ui`.
 */
import type { DueTone } from '$lib/format';

export { button, chip, segment, field, sectionHeading, lift } from 'mushpoint-design/utils/ui';

/** Due-date color by urgency — shared by every goal/subgoal/task list that shows a due label. */
export const DUE_CLASSES: Record<DueTone, string> = {
	none: 'text-muted',
	later: 'text-muted',
	soon: 'font-semibold text-accent-tertiary',
	overdue: 'font-bold text-warn'
};
