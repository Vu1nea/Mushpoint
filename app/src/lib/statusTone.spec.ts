import { describe, expect, it } from 'vitest';
import { GOAL_STATUSES, TASK_STATUSES } from './api/types';
import { statusTone } from './statusTone';

const TONES = ['neutral', 'active', 'done', 'warn', 'danger'];

describe('statusTone', () => {
	it.each([...GOAL_STATUSES, ...TASK_STATUSES])('returns a valid tone for %s', (status) => {
		expect(TONES).toContain(statusTone(status));
	});

	it('maps goal and task statuses', () => {
		expect(statusTone('active')).toBe('active');
		expect(statusTone('completed')).toBe('done');
		expect(statusTone('archived')).toBe('neutral');
		expect(statusTone('todo')).toBe('neutral');
		expect(statusTone('in_progress')).toBe('active');
		expect(statusTone('done')).toBe('done');
	});
});
