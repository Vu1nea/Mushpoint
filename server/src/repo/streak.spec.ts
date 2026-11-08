import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SqlDriver } from '../db/driver';
import { createTestDb, TEST_TZ, type TestDb } from '../testSupport/db';
import * as streak from './streak';
import * as task from './task';
import * as goal from './goal';
import type { StreakCard } from '../types';

let t: TestDb;
let driver: SqlDriver;

beforeEach(async () => {
	t = await createTestDb();
	driver = t.driver;
});

afterEach(async () => {
	vi.useRealTimers();
	await t.release();
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
		const [card] = await streak.list(driver, 20, TEST_TZ);

		expect(card.current).toBe(0);
		expect(card.longest).toBe(0);
		expect(card.doneToday).toBe(false);
		expect(card.cells).toHaveLength(20);
	});

	it('checking off today starts a streak', async () => {
		const id = await habit('Stretch', 'daily');
		const card = await streak.setCompletion(driver, id, null, true, 20, TEST_TZ);

		expect(card.current).toBe(1);
		expect(card.doneToday).toBe(true);
		expect(card.cells.at(-1)?.state).toBe('done');
	});

	it('unchecking removes the completion', async () => {
		const id = await habit('Stretch', 'daily');
		await streak.setCompletion(driver, id, null, true, 20, TEST_TZ);
		const card = await streak.setCompletion(driver, id, null, false, 20, TEST_TZ);

		expect(card.current).toBe(0);
		expect(card.doneToday).toBe(false);
	});

	it('checking off twice is idempotent', async () => {
		const id = await habit('Stretch', 'daily');
		await streak.setCompletion(driver, id, null, true, 20, TEST_TZ);
		const card = await streak.setCompletion(driver, id, null, true, 20, TEST_TZ);

		expect(card.current).toBe(1);
		const rows = await driver.select('SELECT * FROM task_completions');
		expect(rows).toHaveLength(1);
	});

	it('rejects a malformed explicit date without writing anything', async () => {
		const id = await habit('Stretch', 'daily');

		await expect(streak.setCompletion(driver, id, '2026-02-30', true, 20, TEST_TZ)).rejects.toMatchObject({
			kind: 'validation'
		});
		const rows = await driver.select('SELECT * FROM task_completions');
		expect(rows).toHaveLength(0);
	});

	it('days before the task existed are not misses', async () => {
		await habit('Stretch', 'daily');
		const [card] = await streak.list(driver, 20, TEST_TZ);

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

		await expect(streak.setCompletion(driver, oneOff, null, true, 20, TEST_TZ)).rejects.toMatchObject({
			kind: 'validation'
		});
		expect(await streak.list(driver, 20, TEST_TZ)).toHaveLength(0);
	});

	it('listing covers every habit', async () => {
		await habit('Stretch', 'daily');
		await habit('Review the week', 'weekly');

		const titles = (await streak.list(driver, 20, TEST_TZ)).map((card) => card.task.title);
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

		await driver.execute('UPDATE settings SET streak_grace_days = 0');
		let [card] = await streak.list(driver, 20, TEST_TZ);
		expect(card.current).toBe(0);

		await driver.execute('UPDATE settings SET streak_grace_days = 7');
		[card] = await streak.list(driver, 20, TEST_TZ);
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
			motivationImagePath: null,
			repoUrl: null
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

		expect((await goal.getDetail(driver, created.id, TEST_TZ)).progress).toBe(1);
	});
});

describe('streak timezones', () => {
	it("starts a habit's history on the user's local creation date", async () => {
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(new Date('2026-03-10T10:00:00Z')); // 03-11 in Kiritimati (UTC+14), 03-09 in Pago_Pago (UTC-11)
		await habit('Stretch', 'daily');
		vi.setSystemTime(new Date('2026-03-12T01:00:00Z')); // local today: 03-12 Kiritimati, 03-11 Pago_Pago
		const expected = (card: StreakCard) => card.cells.filter((c) => c.state !== 'not_expected').length;
		const kiritimati = (await streak.list(driver, 5, 'Pacific/Kiritimati'))[0];
		const pago = (await streak.list(driver, 5, 'Pacific/Pago_Pago'))[0];
		expect(kiritimati.cells.at(-1)!.date).toBe('2026-03-12');
		expect(pago.cells.at(-1)!.date).toBe('2026-03-11');
		expect(expected(kiritimati)).toBe(2);
		expect(expected(pago)).toBe(3);
	});
});

describe('streak isolation', () => {
	it("does not list or complete another user's habit", async () => {
		const id = await habit('Stretch', 'daily');
		await t.useUser(randomUUID());
		expect(await streak.list(driver, 5, TEST_TZ)).toEqual([]);
		await expect(streak.setCompletion(driver, id, null, true, 5, TEST_TZ)).rejects.toMatchObject({
			kind: 'not_found'
		});
	});
});
