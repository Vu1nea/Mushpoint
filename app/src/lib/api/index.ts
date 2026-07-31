import { call } from './client';
import type {
	Category,
	CategoryInput,
	Goal,
	GoalDetail,
	GoalInput,
	GoalStatus,
	GoalSummary,
	Subgoal,
	SubgoalInput,
	SubgoalUpdate,
	Task,
	TaskInput,
	TaskStatus,
	TaskUpdate
} from './types';

export * from './types';
export { AppError } from './client';
export type { ErrorKind } from './client';

export const listCategories = () => call<Category[]>('list_categories');
export const createCategory = (input: CategoryInput) =>
	call<Category>('create_category', { input });
export const updateCategory = (id: number, input: CategoryInput) =>
	call<Category>('update_category', { id, input });
export const deleteCategory = (id: number) => call<void>('delete_category', { id });

export const listGoals = (status: GoalStatus | null = null) =>
	call<GoalSummary[]>('list_goals', { status });
export const getGoal = (id: number) => call<GoalDetail>('get_goal', { id });
export const createGoal = (input: GoalInput) => call<Goal>('create_goal', { input });
export const updateGoal = (id: number, input: GoalInput) =>
	call<Goal>('update_goal', { id, input });
export const setGoalStatus = (id: number, status: GoalStatus) =>
	call<Goal>('set_goal_status', { id, status });
export const deleteGoal = (id: number) => call<void>('delete_goal', { id });

export const createSubgoal = (input: SubgoalInput) => call<Subgoal>('create_subgoal', { input });
export const updateSubgoal = (id: number, input: SubgoalUpdate) =>
	call<Subgoal>('update_subgoal', { id, input });
export const setSubgoalComplete = (id: number, isComplete: boolean) =>
	call<Subgoal>('set_subgoal_complete', { id, isComplete });
export const deleteSubgoal = (id: number) => call<void>('delete_subgoal', { id });

export const listTasks = () => call<Task[]>('list_tasks');
export const createTask = (input: TaskInput) => call<Task>('create_task', { input });
export const updateTask = (id: number, input: TaskUpdate) =>
	call<Task>('update_task', { id, input });
export const setTaskStatus = (id: number, status: TaskStatus) =>
	call<Task>('set_task_status', { id, status });
export const deleteTask = (id: number) => call<void>('delete_task', { id });
