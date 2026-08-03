import { beforeEach, describe, expect, it } from 'vitest';
import type { SqlDriver } from '../driver';
import { createTestDriver } from '../testDriver';
import * as goal from './goal';
import * as idea from './idea';
import type { GoalInput, IdeaInput } from '../../api/types';

let driver: SqlDriver;

beforeEach(() => {
	driver = createTestDriver();
});

function ideaInput(title: string, tagNames: string[] = []): IdeaInput {
	return { title, note: null, tagNames };
}

function goalInput(title: string): GoalInput {
	return {
		categoryId: null,
		title,
		description: null,
		timeframe: 'mid',
		dueDate: null,
		motivationText: null,
		motivationImagePath: null,
		repoUrl: null
	};
}

describe('idea', () => {
	it('creates an idea with tags', async () => {
		const created = await idea.create(driver, ideaInput('Learn Rust', ['cs', 'winter break']));
		expect(created.title).toBe('Learn Rust');
		expect(created.promotedGoalId).toBeNull();
		expect(created.tags.map((t) => t.name)).toEqual(['cs', 'winter break']);
	});

	it('lists active ideas by default, excluding promoted ones', async () => {
		const kept = await idea.create(driver, ideaInput('Keep me'));
		const promoted = await idea.create(driver, ideaInput('Promote me'));
		const goalCreated = await goal.create(driver, goalInput('A goal'));
		await idea.promote(driver, promoted.id, goalCreated.id);

		const active = await idea.list(driver);
		expect(active.map((i) => i.id)).toEqual([kept.id]);

		const all = await idea.list(driver, { includePromoted: true });
		expect(all).toHaveLength(2);
		expect(all.some((i) => i.id === promoted.id)).toBe(true);
	});

	it('filters by tag, case-insensitively', async () => {
		await idea.create(driver, ideaInput('Tagged', ['CS']));
		await idea.create(driver, ideaInput('Untagged'));

		const filtered = await idea.list(driver, { tag: 'cs' });
		expect(filtered.map((i) => i.title)).toEqual(['Tagged']);
	});

	it('get-or-create collapses tags that differ only by case', async () => {
		const first = await idea.create(driver, ideaInput('First', ['CS']));
		const second = await idea.create(driver, ideaInput('Second', ['cs']));

		expect(first.tags[0].id).toBe(second.tags[0].id);
		expect(await idea.listTags(driver)).toHaveLength(1);
	});

	it('promote sets promoted_goal_id and the idea drops out of the default list', async () => {
		const created = await idea.create(driver, ideaInput('An idea'));
		const goalCreated = await goal.create(driver, goalInput('A goal'));

		const promoted = await idea.promote(driver, created.id, goalCreated.id);
		expect(promoted.promotedGoalId).toBe(goalCreated.id);
		expect(await idea.list(driver)).toHaveLength(0);
	});

	it('resurfaces in the inbox when the promoted goal is deleted', async () => {
		const created = await idea.create(driver, ideaInput('An idea'));
		const goalCreated = await goal.create(driver, goalInput('A goal'));
		await idea.promote(driver, created.id, goalCreated.id);

		await goal.remove(driver, goalCreated.id, false);

		const resurfaced = await idea.get(driver, created.id);
		expect(resurfaced.promotedGoalId).toBeNull();
		expect(await idea.list(driver)).toHaveLength(1);
	});

	it('removing an idea cascades its tag links but leaves the tag itself', async () => {
		const created = await idea.create(driver, ideaInput('An idea', ['cs']));
		await idea.remove(driver, created.id);

		await expect(idea.get(driver, created.id)).rejects.toMatchObject({ kind: 'not_found' });
		expect(await idea.listTags(driver)).toHaveLength(1);
	});

	it('update replaces tag links wholesale rather than diffing', async () => {
		const created = await idea.create(driver, ideaInput('An idea', ['a', 'b']));
		const updated = await idea.update(driver, created.id, ideaInput('An idea', ['b', 'c']));

		expect(updated.tags.map((t) => t.name)).toEqual(['b', 'c']);
	});

	it('rejects a blank title', async () => {
		await expect(idea.create(driver, ideaInput('  '))).rejects.toMatchObject({ kind: 'validation' });
	});
});
