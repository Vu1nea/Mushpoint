import { beforeEach, describe, expect, it } from 'vitest';
import type { SqlDriver } from '../driver';
import { createTestDriver } from '../testDriver';
import * as visionItem from './visionItem';

let driver: SqlDriver;

beforeEach(() => {
	driver = createTestDriver();
});

describe('visionItem', () => {
	it('new items append in position order', async () => {
		const first = await visionItem.create(driver, { imagePath: null, quoteText: 'Keep going' });
		const second = await visionItem.create(driver, { imagePath: 'images/a.png', quoteText: null });

		expect([first.position, second.position]).toEqual([0, 1]);
		expect((await visionItem.list(driver)).map((i) => i.id)).toEqual([first.id, second.id]);
	});

	it('accepts image-only, quote-only, or both', async () => {
		const imageOnly = await visionItem.create(driver, { imagePath: 'images/a.png', quoteText: null });
		const quoteOnly = await visionItem.create(driver, { imagePath: null, quoteText: 'Keep going' });
		const both = await visionItem.create(driver, { imagePath: 'images/b.png', quoteText: 'Both' });

		expect(imageOnly.imagePath).toBe('images/a.png');
		expect(quoteOnly.quoteText).toBe('Keep going');
		expect(both.imagePath).toBe('images/b.png');
		expect(both.quoteText).toBe('Both');
	});

	it('rejects an item with neither image nor quote', async () => {
		await expect(
			visionItem.create(driver, { imagePath: null, quoteText: null })
		).rejects.toMatchObject({ kind: 'validation' });
	});

	it('rejects whitespace-only quote text with no image, same as empty', async () => {
		await expect(
			visionItem.create(driver, { imagePath: null, quoteText: '   ' })
		).rejects.toMatchObject({ kind: 'validation' });
	});

	it('update replaces content and re-validates', async () => {
		const created = await visionItem.create(driver, { imagePath: null, quoteText: 'Original' });
		const updated = await visionItem.update(driver, created.id, {
			imagePath: 'images/new.png',
			quoteText: null
		});

		expect(updated.imagePath).toBe('images/new.png');
		expect(updated.quoteText).toBeNull();

		await expect(
			visionItem.update(driver, created.id, { imagePath: null, quoteText: null })
		).rejects.toMatchObject({ kind: 'validation' });
	});

	it('rejects updating a missing item', async () => {
		await expect(
			visionItem.update(driver, 404, { imagePath: null, quoteText: 'x' })
		).rejects.toMatchObject({ kind: 'not_found' });
	});

	it('remove deletes the row', async () => {
		const created = await visionItem.create(driver, { imagePath: null, quoteText: 'Bye' });
		await visionItem.remove(driver, created.id);

		await expect(visionItem.get(driver, created.id)).rejects.toMatchObject({ kind: 'not_found' });
	});

	it('rejects removing a missing item', async () => {
		await expect(visionItem.remove(driver, 404)).rejects.toMatchObject({ kind: 'not_found' });
	});

	it('reorder rewrites positions to match the given id order', async () => {
		const first = await visionItem.create(driver, { imagePath: null, quoteText: 'First' });
		const second = await visionItem.create(driver, { imagePath: null, quoteText: 'Second' });
		const third = await visionItem.create(driver, { imagePath: null, quoteText: 'Third' });

		await visionItem.reorder(driver, [third.id, first.id, second.id]);

		const ordered = await visionItem.list(driver);
		expect(ordered.map((i) => i.id)).toEqual([third.id, first.id, second.id]);
		expect(ordered.map((i) => i.position)).toEqual([0, 1, 2]);
	});
});
