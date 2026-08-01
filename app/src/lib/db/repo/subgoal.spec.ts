import { beforeEach, describe, expect, it } from 'vitest';
import type { SqlDriver } from '../driver';
import { createTestDriver } from '../testDriver';
import * as subgoal from './subgoal';
import * as task from './task';

let driver: SqlDriver;

beforeEach(() => {
	driver = createTestDriver();
});

async function seedGoal(): Promise<number> {
	const now = new Date().toISOString();
	const result = await driver.execute(
		"INSERT INTO goals (title, timeframe, created_at, updated_at) VALUES ('Ship v1', 'mid', ?1, ?1)",
		[now]
	);
	return result.lastInsertId;
}

async function add(goalId: number, title: string) {
	return subgoal.create(driver, { goalId, title, dueDate: null });
}

describe('subgoal', () => {
	it('new subgoals append in order', async () => {
		const goalId = await seedGoal();
		const first = await add(goalId, 'Write the schema');
		const second = await add(goalId, 'Wire the UI');

		expect([first.position, second.position]).toEqual([0, 1]);
		expect(await subgoal.listForGoal(driver, goalId)).toHaveLength(2);
	});

	it('list all spans every goal in position order', async () => {
		const firstGoal = await seedGoal();
		const secondGoal = await seedGoal();

		await add(firstGoal, 'Write the schema');
		await add(secondGoal, 'Book the flight');
		await add(firstGoal, 'Wire the UI');

		const titles = (await subgoal.listAll(driver)).map((s) => s.title);
		expect(titles).toEqual(['Write the schema', 'Wire the UI', 'Book the flight']);
	});

	it('rejects a missing goal', async () => {
		await expect(
			subgoal.create(driver, { goalId: 404, title: 'Orphan', dueDate: null })
		).rejects.toMatchObject({ kind: 'not_found' });
	});

	it('taskless subgoal progress follows its checkbox', async () => {
		const goalId = await seedGoal();
		const created = await add(goalId, 'Write the schema');

		expect(await subgoal.progressesForGoal(driver, goalId)).toEqual([0]);

		await subgoal.setComplete(driver, created.id, true);
		expect(await subgoal.progressesForGoal(driver, goalId)).toEqual([1]);
	});

	it('subgoal with tasks averages them', async () => {
		const goalId = await seedGoal();
		const created = await add(goalId, 'Write the schema');

		for (const title of ['Draft the tables', 'Add indexes']) {
			await task.create(driver, {
				title,
				dueDate: null,
				goalId: null,
				subgoalId: created.id,
				recurrence: null
			});
		}
		const first = (await task.listForSubgoal(driver, created.id))[0];
		await task.setStatus(driver, first.id, 'done');

		expect(await subgoal.progressesForGoal(driver, goalId)).toEqual([0.5]);
	});

	it('deleting a subgoal leaves its tasks on the goal', async () => {
		const goalId = await seedGoal();
		const created = await add(goalId, 'Write the schema');
		await task.create(driver, {
			title: 'Draft the tables',
			dueDate: null,
			goalId: null,
			subgoalId: created.id,
			recurrence: null
		});

		await subgoal.remove(driver, created.id);

		expect(await task.listDirectForGoal(driver, goalId)).toHaveLength(1);
	});
});
