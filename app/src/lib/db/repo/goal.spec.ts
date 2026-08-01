import { beforeEach, describe, expect, it } from 'vitest';
import type { SqlDriver } from '../driver';
import { createTestDriver } from '../testDriver';
import * as goal from './goal';
import * as subgoal from './subgoal';
import * as task from './task';
import * as category from './category';
import type { GoalInput } from '../../api/types';

let driver: SqlDriver;

beforeEach(() => {
	driver = createTestDriver();
});

function input(title: string): GoalInput {
	return {
		categoryId: null,
		title,
		description: null,
		timeframe: 'mid',
		dueDate: null,
		motivationText: null,
		motivationImagePath: null
	};
}

async function addSubgoal(goalId: number, title: string) {
	return (await subgoal.create(driver, { goalId, title, dueDate: null })).id;
}

async function addTask(goalId: number | null, subgoalId: number | null) {
	return (
		await task.create(driver, {
			title: 'A task',
			dueDate: null,
			goalId,
			subgoalId,
			recurrence: null
		})
	).id;
}

describe('goal', () => {
	it('creates a goal as active', async () => {
		const created = await goal.create(driver, input('Ship v1'));
		expect(created.status).toBe('active');
		expect(created.timeframe).toBe('mid');
	});

	it('rejects a blank title or missing category', async () => {
		await expect(goal.create(driver, input('  '))).rejects.toMatchObject({ kind: 'validation' });
		await expect(
			goal.create(driver, { ...input('Ship v1'), categoryId: 404 })
		).rejects.toMatchObject({ kind: 'not_found' });
	});

	it('a goal with no children sits at zero', async () => {
		await goal.create(driver, input('Ship v1'));
		const [summary] = await goal.list(driver, null);
		expect(summary.progress).toBe(0);
	});

	it('progress averages subgoals and direct tasks equally', async () => {
		const created = await goal.create(driver, input('Ship v1'));

		const subgoalId = await addSubgoal(created.id, 'Write the schema');
		const done = await addTask(null, subgoalId);
		await addTask(null, subgoalId);
		await task.setStatus(driver, done, 'done');

		const direct = await addTask(created.id, null);
		await task.setStatus(driver, direct, 'done');

		const detail = await goal.getDetail(driver, created.id);
		expect(detail.progress).toBe(0.75);
		expect(detail.subgoals[0].progress).toBe(0.5);
		expect(detail.directTasks).toHaveLength(1);
	});

	it('in-progress tasks do not count as partial', async () => {
		const created = await goal.create(driver, input('Ship v1'));
		const taskId = await addTask(created.id, null);
		await task.setStatus(driver, taskId, 'in_progress');

		expect((await goal.getDetail(driver, created.id)).progress).toBe(0);
	});

	it('status is independent of progress', async () => {
		const created = await goal.create(driver, input('Ship v1'));
		const taskId = await addTask(created.id, null);
		await task.setStatus(driver, taskId, 'done');

		expect((await goal.getDetail(driver, created.id)).progress).toBe(1);
		expect((await goal.get(driver, created.id)).status).toBe('active');

		await goal.setStatus(driver, created.id, 'completed');
		expect(await goal.list(driver, 'active')).toHaveLength(0);
		expect(await goal.list(driver, 'completed')).toHaveLength(1);
	});

	it('detail carries the linked category', async () => {
		const [firstCategory] = await category.list(driver);
		const created = await goal.create(driver, { ...input('Ship v1'), categoryId: firstCategory.id });

		const detail = await goal.getDetail(driver, created.id);
		expect(detail.category?.id).toBe(firstCategory.id);
	});

	it('deleting a goal removes its subgoals and unlinks its tasks', async () => {
		const created = await goal.create(driver, input('Ship v1'));
		const subgoalId = await addSubgoal(created.id, 'Write the schema');
		const directTaskId = await addTask(created.id, null);
		const subgoalTaskId = await addTask(null, subgoalId);

		await goal.remove(driver, created.id, false);

		await expect(goal.get(driver, created.id)).rejects.toMatchObject({ kind: 'not_found' });
		expect((await task.get(driver, directTaskId)).goalId).toBeNull();
		expect((await task.get(driver, subgoalTaskId)).subgoalId).toBeNull();
	});

	it('deleting a goal can also delete its subgoal tasks', async () => {
		const created = await goal.create(driver, input('Ship v1'));
		const subgoalId = await addSubgoal(created.id, 'Write the schema');
		const directTaskId = await addTask(created.id, null);
		const subgoalTaskId = await addTask(null, subgoalId);

		await goal.remove(driver, created.id, true);

		expect((await task.get(driver, directTaskId)).goalId).toBeNull();
		await expect(task.get(driver, subgoalTaskId)).rejects.toMatchObject({ kind: 'not_found' });
	});
});
