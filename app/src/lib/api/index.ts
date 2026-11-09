import { request } from './http';
import type {
	Category,
	CategoryInput,
	Goal,
	GoalDetail,
	GoalInput,
	GoalStatus,
	GoalSummary,
	Idea,
	IdeaInput,
	StreakCard,
	Subgoal,
	SubgoalInput,
	SubgoalUpdate,
	Tag,
	Task,
	TaskInput,
	TaskStatus,
	TaskSummary,
	TaskUpdate,
	VisionItemInput
} from './types';
import type { VisionItemView } from './viewTypes';

export * from './types';
export * from './viewTypes';
export { AppError } from './error';
export type { ErrorKind } from './error';

/** Appends the defined params as a query string; null/undefined are left out. */
function withQuery(
	path: string,
	params: Record<string, string | number | boolean | null | undefined>
) {
	const query = new URLSearchParams();
	for (const [key, value] of Object.entries(params)) {
		if (value !== null && value !== undefined) query.set(key, String(value));
	}
	const text = query.toString();
	return text ? `${path}?${text}` : path;
}

export const listCategories = (): Promise<Category[]> => request('GET', '/categories');
export const createCategory = (input: CategoryInput): Promise<Category> =>
	request('POST', '/categories', input);
export const updateCategory = (id: number, input: CategoryInput): Promise<Category> =>
	request('PUT', `/categories/${id}`, input);
export const deleteCategory = (id: number): Promise<void> => request('DELETE', `/categories/${id}`);

export const listGoals = (status: GoalStatus | null = null): Promise<GoalSummary[]> =>
	request('GET', withQuery('/goals', { status }));
export const getGoal = (id: number): Promise<GoalDetail> => request('GET', `/goals/${id}`);
export const createGoal = (input: GoalInput): Promise<Goal> => request('POST', '/goals', input);
export const updateGoal = (id: number, input: GoalInput): Promise<Goal> =>
	request('PUT', `/goals/${id}`, input);
export const setGoalStatus = (id: number, status: GoalStatus): Promise<Goal> =>
	request('PUT', `/goals/${id}/status`, { status });
export const deleteGoal = (id: number, deleteOrphanedTasks: boolean): Promise<void> =>
	request('DELETE', withQuery(`/goals/${id}`, { deleteOrphanedTasks }));

export const listSubgoals = (): Promise<Subgoal[]> => request('GET', '/subgoals');
export const createSubgoal = (input: SubgoalInput): Promise<Subgoal> =>
	request('POST', '/subgoals', input);
export const updateSubgoal = (id: number, input: SubgoalUpdate): Promise<Subgoal> =>
	request('PUT', `/subgoals/${id}`, input);
export const setSubgoalComplete = (id: number, isComplete: boolean): Promise<Subgoal> =>
	request('PUT', `/subgoals/${id}/complete`, { isComplete });
export const deleteSubgoal = (id: number): Promise<void> => request('DELETE', `/subgoals/${id}`);

export const listTasks = (): Promise<TaskSummary[]> => request('GET', '/tasks');
export const createTask = (input: TaskInput): Promise<Task> => request('POST', '/tasks', input);
export const updateTask = (id: number, input: TaskUpdate): Promise<Task> =>
	request('PUT', `/tasks/${id}`, input);
export const setTaskStatus = (id: number, status: TaskStatus): Promise<Task> =>
	request('PUT', `/tasks/${id}/status`, { status });
export const deleteTask = (id: number): Promise<void> => request('DELETE', `/tasks/${id}`);

/** Omitting `days` lets the server pick its default window. */
export const listStreaks = (days?: number): Promise<StreakCard[]> =>
	request('GET', withQuery('/streaks', { days }));
/** `date` is a local `YYYY-MM-DD`; omit it to mean today. */
export const setTaskCompletion = (
	id: number,
	done: boolean,
	date: string | null = null
): Promise<StreakCard> => request('PUT', `/tasks/${id}/completion`, { done, date });

export const listIdeas = (opts?: { tag?: string; includePromoted?: boolean }): Promise<Idea[]> =>
	request(
		'GET',
		withQuery('/ideas', { tag: opts?.tag || null, includePromoted: opts?.includePromoted })
	);
export const getIdea = (id: number): Promise<Idea> => request('GET', `/ideas/${id}`);
export const createIdea = (input: IdeaInput): Promise<Idea> => request('POST', '/ideas', input);
export const updateIdea = (id: number, input: IdeaInput): Promise<Idea> =>
	request('PUT', `/ideas/${id}`, input);
export const deleteIdea = (id: number): Promise<void> => request('DELETE', `/ideas/${id}`);
export const promoteIdea = (id: number, goalId: number): Promise<Idea> =>
	request('POST', `/ideas/${id}/promote`, { goalId });
export const listIdeaTags = (): Promise<Tag[]> => request('GET', '/idea-tags');

/** The server removes a replaced or deleted item's image itself. */
export const listVisionItems = (): Promise<VisionItemView[]> => request('GET', '/vision-items');
export const createVisionItem = (input: VisionItemInput): Promise<VisionItemView> =>
	request('POST', '/vision-items', input);
export const updateVisionItem = (id: number, input: VisionItemInput): Promise<VisionItemView> =>
	request('PUT', `/vision-items/${id}`, input);
export const deleteVisionItem = (id: number): Promise<void> =>
	request('DELETE', `/vision-items/${id}`);
export const reorderVisionItems = (orderedIds: number[]): Promise<void> =>
	request('PUT', '/vision-items/order', { orderedIds });
