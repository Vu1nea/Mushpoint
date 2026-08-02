import { beforeEach, describe, expect, it } from 'vitest';
import type { SqlDriver } from '../driver';
import { createTestDriver } from '../testDriver';
import * as completion from './completion';

let driver: SqlDriver;

beforeEach(() => {
	driver = createTestDriver();
});

async function seedHabit(): Promise<number> {
	const result = await driver.execute(
		"INSERT INTO tasks (title, recurrence, created_at, updated_at) VALUES ('Stretch', 'daily', datetime('now'), datetime('now'))"
	);
	return result.lastInsertId;
}

describe('completion', () => {
	it('logging the same day twice keeps one row', async () => {
		const taskId = await seedHabit();
		await completion.set(driver, taskId, '2026-07-30', true);
		await completion.set(driver, taskId, '2026-07-30', true);

		const dates = await completion.datesForTask(driver, taskId, '2026-07-30', '2026-07-30');
		expect(dates.size).toBe(1);
	});

	it('unlogging a day that was never logged is harmless', async () => {
		const taskId = await seedHabit();
		await completion.set(driver, taskId, '2026-07-30', false);

		const dates = await completion.datesForTask(driver, taskId, '2026-07-30', '2026-07-30');
		expect(dates.size).toBe(0);
	});

	it('the range is inclusive at both ends', async () => {
		const taskId = await seedHabit();
		for (const day of ['2026-07-28', '2026-07-29', '2026-07-30', '2026-07-31']) {
			await completion.set(driver, taskId, day, true);
		}

		const found = await completion.datesForTask(driver, taskId, '2026-07-29', '2026-07-30');
		expect(found.size).toBe(2);
		expect(found.has('2026-07-29')).toBe(true);
	});
});
