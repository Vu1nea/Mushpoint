import { beforeEach, describe, expect, it } from 'vitest';
import type { SqlDriver } from '../driver';
import { createTestDriver } from '../testDriver';
import { AppError } from '../error';
import * as category from './category';
import type { CategoryInput } from '../../api/types';

let driver: SqlDriver;

beforeEach(() => {
	driver = createTestDriver();
});

function input(name: string): CategoryInput {
	return { name, colorToken: null };
}

describe('category', () => {
	it('lists the five seeded defaults', async () => {
		expect(await category.list(driver)).toHaveLength(5);
	});

	it('creates a custom category', async () => {
		const created = await category.create(driver, input('  Reading  '));
		expect(created.name).toBe('Reading');
		expect(created.isDefault).toBe(false);
	});

	it('rejects a blank name', async () => {
		await expect(category.create(driver, input('   '))).rejects.toMatchObject({
			kind: 'validation'
		});
	});

	it('rejects a duplicate name', async () => {
		await expect(category.create(driver, input('Gym'))).rejects.toMatchObject({
			kind: 'validation'
		});
	});

	it('updates and deletes', async () => {
		const created = await category.create(driver, input('Readin'));
		const renamed = await category.update(driver, created.id, input('Reading'));
		expect(renamed.name).toBe('Reading');

		await category.remove(driver, created.id);
		await expect(category.get(driver, created.id)).rejects.toMatchObject({ kind: 'not_found' });
	});

	it('reports missing categories', async () => {
		await expect(category.update(driver, 999, input('Nope'))).rejects.toMatchObject({
			kind: 'not_found'
		});
		await expect(category.remove(driver, 999)).rejects.toMatchObject({ kind: 'not_found' });
	});
});
