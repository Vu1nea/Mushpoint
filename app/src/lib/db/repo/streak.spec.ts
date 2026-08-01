import { beforeEach, describe, expect, it } from 'vitest';
import type { SqlDriver } from '../driver';
import { createTestDriver } from '../testDriver';
import * as streak from './streak';
import * as task from './task';
import * as goal from './goal';

let driver: SqlDriver;

beforeEach(() => {
	driver = createTestDriver();
});

async function habit(title: string, recurrence: 'daily' | 'weekly' | 'weekdays') {
	return (
		await task.create(driver, {
			title,
			dueDate: null,
			goalId: null,
			subgoalId: null,
			recurrence
		})
	).id;
}

describe('streak', () => {
	it('a fresh habit has an empty streak', async () => {
		await habit('Stretch', 'daily');
		const [card] = await streak.list(driver, 20);

		expect(card.current).toBe(0);
		expect(card.longest).toBe(0);
		expect(card.doneToday).toBe(false);
		expect(card.cells).toHaveLength(20);
	});

	it('checking off today starts a streak', async () => {
		const id = await habit('Stretch', 'daily');
		const card = await streak.setCompletion(driver, id, null, true, 20);

		expect(card.current).toBe(1);
		expect(card.doneToday).toBe(true);
		expect(card.cells.at(-1)?.state).toBe('done');
	});

	it('unchecking removes the completion', async () => {
		const id = await habit('Stretch', 'daily');
		await streak.setCompletion(driver, id, null, true, 20);
		const card = await streak.setCompletion(driver, id, null, false, 20);

		expect(card.current).toBe(0);
		expect(card.doneToday).toBe(false);
	});

	it('checking off twice is idempotent', async () => {
		const id = await habit('Stretch', 'daily');
		await streak.setCompletion(driver, id, null, true, 20);
		const card = await streak.setCompletion(driver, id, null, true, 20);

		expect(card.current).toBe(1);
		const rows = await driver.select('SELECT * FROM task_completions');
		expect(rows).toHaveLength(1);
	});

	it('days before the task existed are not misses', async () => {
		await habit('Stretch', 'daily');
		const [card] = await streak.list(driver, 20);

		const notExpected = card.cells.filter((cell) => cell.state === 'not_expected').length;
		expect(notExpected).toBe(19);
	});

	it('only recurring tasks have streaks', async () => {
		const oneOff = (
			await task.create(driver, {
				title: 'Buy a notebook',
				dueDate: null,
				goalId: null,
				subgoalId: null,
				recurrence: null
			})
		).id;

		await expect(streak.setCompletion(driver, oneOff, null, true, 20)).rejects.toMatchObject({
			kind: 'validation'
		});
		expect(await streak.list(driver, 20)).toHaveLength(0);
	});

	it('listing covers every habit', async () => {
		await habit('Stretch', 'daily');
		await habit('Review the week', 'weekly');

		const titles = (await streak.list(driver, 20)).map((card) => card.task.title);
		expect(titles).toHaveLength(2);
		expect(titles).toContain('Stretch');
	});

	it('the grace setting changes the answer', async () => {
		const id = await habit('Stretch', 'daily');
		const today = new Date();
		const backdated = new Date(today);
		backdated.setDate(backdated.getDate() - 2);
		await driver.execute('UPDATE tasks SET created_at = ?1 WHERE id = ?2', [
			backdated.toISOString(),
			id
		]);
		const backdatedDate = backdated.toISOString().slice(0, 10);
		await driver.execute(
			'INSERT INTO task_completions (task_id, completed_on, created_at) VALUES (?1, ?2, ?3)',
			[id, backdatedDate, backdated.toISOString()]
		);

		await driver.execute('UPDATE settings SET streak_grace_days = 0 WHERE id = 1');
		let [card] = await streak.list(driver, 20);
		expect(card.current).toBe(0);

		await driver.execute('UPDATE settings SET streak_grace_days = 7 WHERE id = 1');
		[card] = await streak.list(driver, 20);
		expect(card.current).toBe(1);
	});

	it('habits are left out of goal progress', async () => {
		const created = await goal.create(driver, {
			categoryId: null,
			title: 'Get fit',
			description: null,
			timeframe: 'mid',
			dueDate: null,
			motivationText: null,
			motivationImagePath: null
		});

		const ordinary = (
			await task.create(driver, {
				title: 'Buy shoes',
				dueDate: null,
				goalId: created.id,
				subgoalId: null,
				recurrence: null
			})
		).id;
		await task.setStatus(driver, ordinary, 'done');
		await task.create(driver, {
			title: 'Stretch',
			dueDate: null,
			goalId: created.id,
			subgoalId: null,
			recurrence: 'daily'
		});

		expect((await goal.getDetail(driver, created.id)).progress).toBe(1);
	});
});
