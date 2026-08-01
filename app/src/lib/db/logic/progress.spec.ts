import { describe, expect, it } from 'vitest';
import {
	average,
	countsTowardProgress,
	goalProgress,
	subgoalProgress,
	taskCompletion
} from './progress';
import type { Task } from '../../api/types';

function assertClose(actual: number, expected: number) {
	expect(Math.abs(actual - expected)).toBeLessThan(1e-9);
}

describe('average', () => {
	it('is zero for no completions', () => {
		assertClose(average([]), 0);
	});

	it('averages values', () => {
		assertClose(average([0, 1]), 0.5);
		assertClose(average([1, 1, 1]), 1);
	});
});

describe('subgoalProgress', () => {
	it('without tasks uses its own flag', () => {
		assertClose(subgoalProgress(false, []), 0);
		assertClose(subgoalProgress(true, []), 1);
	});

	it('with tasks ignores its own flag', () => {
		assertClose(subgoalProgress(true, [0, 0]), 0);
		assertClose(subgoalProgress(false, [1, 1]), 1);
	});
});

describe('goalProgress', () => {
	it('is zero with no children', () => {
		assertClose(goalProgress([], []), 0);
	});

	it('weighs subgoals and direct tasks equally', () => {
		// Three children, one complete.
		assertClose(goalProgress([1, 0], [0]), 1 / 3);
	});

	it('a half-done subgoal contributes a half', () => {
		const half = subgoalProgress(false, [1, 0]);
		assertClose(half, 0.5);
		assertClose(goalProgress([half], [1]), 0.75);
	});

	it('can regress after reaching full', () => {
		const full = goalProgress([1], [1]);
		assertClose(full, 1);
		assertClose(goalProgress([1], [0]), 0.5);
	});
});

describe('taskCompletion', () => {
	it('counts only done as complete', () => {
		expect(taskCompletion('done')).toBe(1);
		expect(taskCompletion('todo')).toBe(0);
		expect(taskCompletion('in_progress')).toBe(0);
	});
});

describe('countsTowardProgress', () => {
	const base: Task = {
		id: 1,
		title: 'Stretch',
		status: 'todo',
		dueDate: null,
		goalId: null,
		subgoalId: null,
		recurrence: null,
		createdAt: '',
		updatedAt: ''
	};

	it('is true for one-off tasks, false for habits', () => {
		expect(countsTowardProgress(base)).toBe(true);
		expect(countsTowardProgress({ ...base, recurrence: 'daily' })).toBe(false);
	});
});
