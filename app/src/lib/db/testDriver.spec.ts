import { describe, expect, it } from 'vitest';
import { createTestDriver } from './testDriver';

describe('createTestDriver', () => {
	it('applies the schema and seeds default categories', async () => {
		const driver = createTestDriver();
		const rows = await driver.select<{ name: string }>(
			'SELECT name FROM categories ORDER BY id'
		);
		expect(rows.map((r) => r.name)).toEqual([
			'Work',
			'Gym',
			'School',
			'Side Projects',
			'Social'
		]);
	});

	it('binds numbered positional placeholders', async () => {
		const driver = createTestDriver();
		const rows = await driver.select<{ theme: string }>(
			'SELECT active_theme as theme FROM settings WHERE id = ?1',
			[1]
		);
		expect(rows[0].theme).toBe('nocturne');
	});

	it('reports lastInsertId and rowsAffected on execute', async () => {
		const driver = createTestDriver();
		const result = await driver.execute(
			'INSERT INTO categories (name, is_default, created_at) VALUES (?1, 0, ?2)',
			['Reading', new Date().toISOString()]
		);
		expect(result.rowsAffected).toBe(1);
		expect(result.lastInsertId).toBeGreaterThan(0);
	});

	it('enforces foreign keys with cascade deletes', async () => {
		const driver = createTestDriver();
		const now = new Date().toISOString();
		const goal = await driver.execute(
			"INSERT INTO goals (title, timeframe, created_at, updated_at) VALUES ('Ship v1', 'mid', ?1, ?1)",
			[now]
		);
		await driver.execute(
			"INSERT INTO subgoals (goal_id, title, created_at, updated_at) VALUES (?1, 'Write the schema', ?2, ?2)",
			[goal.lastInsertId, now]
		);
		await driver.execute('DELETE FROM goals WHERE id = ?1', [goal.lastInsertId]);
		const remaining = await driver.select('SELECT * FROM subgoals');
		expect(remaining).toHaveLength(0);
	});
});
