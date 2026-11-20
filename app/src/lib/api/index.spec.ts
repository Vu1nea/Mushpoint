import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteAccount, exportAccount, setUsername } from './account';
import { request } from './http';
import {
	deleteGoal,
	listGoals,
	listIdeas,
	listStreaks,
	promoteIdea,
	reorderVisionItems,
	setTaskCompletion
} from './index';
import { setStreakGraceDays } from './settings';

vi.mock('./http', () => ({ request: vi.fn() }));

const requestMock = vi.mocked(request);

const goalInput = {
	categoryId: null,
	title: 'G',
	description: null,
	timeframe: 'mid' as const,
	dueDate: null,
	motivationText: null,
	motivationImagePath: null,
	repoUrl: null
};

beforeEach(() => {
	requestMock.mockReset();
	requestMock.mockResolvedValue(undefined);
});

describe('api routes', () => {
	it.each([
		['listGoals', () => listGoals('active'), ['GET', '/goals?status=active']],
		['deleteGoal', () => deleteGoal(3, true), ['DELETE', '/goals/3?deleteOrphanedTasks=true']],
		[
			'setTaskCompletion',
			() => setTaskCompletion(5, true, '2026-11-08'),
			['PUT', '/tasks/5/completion', { done: true, date: '2026-11-08' }]
		],
		['listStreaks', () => listStreaks(14), ['GET', '/streaks?days=14']],
		[
			'listIdeas',
			() => listIdeas({ tag: 'x', includePromoted: true }),
			['GET', '/ideas?tag=x&includePromoted=true']
		],
		['promoteIdea', () => promoteIdea(2, goalInput), ['POST', '/ideas/2/promote', goalInput]],
		[
			'reorderVisionItems',
			() => reorderVisionItems([3, 1]),
			['PUT', '/vision-items/order', { orderedIds: [3, 1] }]
		],
		[
			'setStreakGraceDays',
			() => setStreakGraceDays(2),
			['PUT', '/settings/streak-grace-days', { days: 2 }]
		],
		[
			'setUsername',
			() => setUsername('alpha'),
			['PUT', '/profile/username', { username: 'alpha' }]
		],
		['deleteAccount', () => deleteAccount(), ['DELETE', '/account']],
		['exportAccount', () => exportAccount(), ['GET', '/account/export']]
	])('%s sends the matching request', async (_name, call, expected) => {
		await call();
		expect(requestMock).toHaveBeenCalledTimes(1);
		expect(requestMock).toHaveBeenCalledWith(...expected);
	});

	it('resolves with the server response', async () => {
		const goals = [{ id: 1 }];
		requestMock.mockResolvedValue(goals);
		await expect(listGoals()).resolves.toBe(goals);
		expect(requestMock).toHaveBeenCalledWith('GET', '/goals');
	});
});
