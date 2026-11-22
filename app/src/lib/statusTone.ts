import type { PillTone } from 'mushpoint-design/utils/ui';
import type { GoalStatus, TaskStatus } from './api/types';

const TONES: Record<GoalStatus | TaskStatus, PillTone> = {
	active: 'active',
	completed: 'done',
	archived: 'neutral',
	todo: 'neutral',
	in_progress: 'active',
	done: 'done'
};

export function statusTone(status: GoalStatus | TaskStatus): PillTone {
	return TONES[status];
}
