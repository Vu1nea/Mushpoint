import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SqlDriver } from '../driver';
import { createTestDriver } from '../testDriver';
import * as task from './task';
import { today } from './helpers';
import type { TaskInput } from '../../api/types';

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

async function seedSubgoal(goalId: number): Promise<number> {
	const now = new Date().toISOString();
	const result = await driver.execute(
		"INSERT INTO subgoals (goal_id, title, created_at, updated_at) VALUES (?1, 'Write the schema', ?2, ?2)",
		[goalId, now]
	);
	return result.lastInsertId;
}

function taskInput(title: string): TaskInput {
	return { title, dueDate: null, goalId: null, subgoalId: null, recurrence: null };
}

describe('task', () => {
	it('creates an unlinked task as todo', async () => {
		const created = await task.create(driver, taskInput('Buy a notebook'));
		expect(created.status).toBe('todo');
		expect(created.goalId).toBeNull();
	});

	it('a cadence makes a task recurring', async () => {
		const oneOff = await task.create(driver, taskInput('Buy a notebook'));
		const habit = await task.create(driver, { ...taskInput('Stretch'), recurrence: 'weekdays' });

		expect(task.isRecurring(oneOff)).toBe(false);
		expect(task.isRecurring(habit)).toBe(true);
		expect((await task.get(driver, habit.id)).recurrence).toBe('weekdays');
	});

	it('a subgoal task inherits that subgoals goal', async () => {
		const goalId = await seedGoal();
		const subgoalId = await seedSubgoal(goalId);

		const created = await task.create(driver, {
			// Deliberately wrong parent goal: the subgoal wins.
			...taskInput('Draft the tables'),
			goalId: null,
			subgoalId
		});

		expect(created.goalId).toBe(goalId);
		expect(created.subgoalId).toBe(subgoalId);
	});

	it('direct goal tasks exclude subgoal tasks', async () => {
		const goalId = await seedGoal();
		const subgoalId = await seedSubgoal(goalId);

		await task.create(driver, { ...taskInput('Read the OKR book'), goalId });
		await task.create(driver, { ...taskInput('Draft the tables'), subgoalId });

		expect(await task.listDirectForGoal(driver, goalId)).toHaveLength(1);
	});

	it('rejects linking to a missing parent', async () => {
		await expect(
			task.create(driver, { ...taskInput('Orphan'), goalId: 404 })
		).rejects.toMatchObject({ kind: 'not_found' });
		await expect(
			task.create(driver, { ...taskInput('Orphan'), subgoalId: 404 })
		).rejects.toMatchObject({ kind: 'not_found' });
	});

	it('status changes and deletes', async () => {
		const created = await task.create(driver, taskInput('Buy a notebook'));
		const done = await task.setStatus(driver, created.id, 'done');
		expect(done.status).toBe('done');

		await task.remove(driver, created.id);
		await expect(task.get(driver, created.id)).rejects.toMatchObject({ kind: 'not_found' });
	});

	describe('completedToday and expectedToday', () => {
		afterEach(() => {
			vi.useRealTimers();
		});

		async function complete(taskId: number, on: string) {
			await driver.execute(
				'INSERT INTO task_completions (task_id, completed_on, created_at) VALUES (?1, ?2, ?3)',
				[taskId, on, new Date().toISOString()]
			);
		}

		it('a non-recurring task is always expected and starts uncompleted', async () => {
			const created = await task.create(driver, taskInput('Buy a notebook'));
			const [row] = await task.list(driver);

			expect(row.id).toBe(created.id);
			expect(row.expectedToday).toBe(true);
			expect(row.completedToday).toBe(false);
		});

		it('the board list picks up a completion logged for today', async () => {
			const created = await task.create(driver, { ...taskInput('Stretch'), recurrence: 'daily' });
			await complete(created.id, today());

			const [row] = await task.list(driver);
			expect(row.completedToday).toBe(true);
		});

		it('a weekly habit is expected only on its anchor weekday', async () => {
			vi.setSystemTime(new Date('2026-07-28T12:00:00Z')); // Tuesday
			const created = await task.create(driver, {
				...taskInput('Review the week'),
				recurrence: 'weekly'
			});
			expect((await task.list(driver))[0].expectedToday).toBe(true);

			vi.setSystemTime(new Date('2026-07-29T12:00:00Z')); // Wednesday
			expect((await task.get(driver, created.id)).id).toBe(created.id);
			expect((await task.list(driver))[0].expectedToday).toBe(false);
		});

		it('direct goal tasks report completedToday', async () => {
			const goalId = await seedGoal();
			const created = await task.create(driver, {
				...taskInput('Stretch'),
				goalId,
				recurrence: 'daily'
			});
			await complete(created.id, today());

			const [row] = await task.listDirectForGoal(driver, goalId);
			expect(row.completedToday).toBe(true);
		});

		it('subgoal tasks report completedToday', async () => {
			const goalId = await seedGoal();
			const subgoalId = await seedSubgoal(goalId);
			const created = await task.create(driver, {
				...taskInput('Stretch'),
				subgoalId,
				recurrence: 'daily'
			});
			await complete(created.id, today());

			const [row] = await task.listForSubgoal(driver, subgoalId);
			expect(row.completedToday).toBe(true);
		});
	});
});
