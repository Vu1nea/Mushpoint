import { getDriver } from '../db/connection';
import { AppError } from '../db/error';
import * as categoryRepo from '../db/repo/category';
import * as goalRepo from '../db/repo/goal';
import * as ideaRepo from '../db/repo/idea';
import * as subgoalRepo from '../db/repo/subgoal';
import * as taskRepo from '../db/repo/task';
import * as streakRepo from '../db/repo/streak';
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
	TaskUpdate
} from './types';

export * from './types';
export { AppError };
export type { ErrorKind } from '../db/error';

export const listCategories = async (): Promise<Category[]> => categoryRepo.list(await getDriver());
export const createCategory = async (input: CategoryInput): Promise<Category> =>
	categoryRepo.create(await getDriver(), input);
export const updateCategory = async (id: number, input: CategoryInput): Promise<Category> =>
	categoryRepo.update(await getDriver(), id, input);
export const deleteCategory = async (id: number): Promise<void> =>
	categoryRepo.remove(await getDriver(), id);

export const listGoals = async (status: GoalStatus | null = null): Promise<GoalSummary[]> =>
	goalRepo.list(await getDriver(), status);
export const getGoal = async (id: number): Promise<GoalDetail> => goalRepo.getDetail(await getDriver(), id);
export const createGoal = async (input: GoalInput): Promise<Goal> => goalRepo.create(await getDriver(), input);
export const updateGoal = async (id: number, input: GoalInput): Promise<Goal> =>
	goalRepo.update(await getDriver(), id, input);
export const setGoalStatus = async (id: number, status: GoalStatus): Promise<Goal> =>
	goalRepo.setStatus(await getDriver(), id, status);
export const deleteGoal = async (id: number, deleteOrphanedTasks: boolean): Promise<void> =>
	goalRepo.remove(await getDriver(), id, deleteOrphanedTasks);

export const listSubgoals = async (): Promise<Subgoal[]> => subgoalRepo.listAll(await getDriver());
export const createSubgoal = async (input: SubgoalInput): Promise<Subgoal> =>
	subgoalRepo.create(await getDriver(), input);
export const updateSubgoal = async (id: number, input: SubgoalUpdate): Promise<Subgoal> =>
	subgoalRepo.update(await getDriver(), id, input);
export const setSubgoalComplete = async (id: number, isComplete: boolean): Promise<Subgoal> =>
	subgoalRepo.setComplete(await getDriver(), id, isComplete);
export const deleteSubgoal = async (id: number): Promise<void> =>
	subgoalRepo.remove(await getDriver(), id);

export const listTasks = async (): Promise<TaskSummary[]> => taskRepo.list(await getDriver());
export const createTask = async (input: TaskInput): Promise<Task> => taskRepo.create(await getDriver(), input);
export const updateTask = async (id: number, input: TaskUpdate): Promise<Task> =>
	taskRepo.update(await getDriver(), id, input);
export const setTaskStatus = async (id: number, status: TaskStatus): Promise<Task> =>
	taskRepo.setStatus(await getDriver(), id, status);
export const deleteTask = async (id: number): Promise<void> => taskRepo.remove(await getDriver(), id);

export const listStreaks = async (days?: number): Promise<StreakCard[]> =>
	streakRepo.list(await getDriver(), days ?? streakRepo.DEFAULT_CELL_DAYS);
/** `date` is a local `YYYY-MM-DD`; omit it to mean today. */
export const setTaskCompletion = async (
	id: number,
	done: boolean,
	date: string | null = null
): Promise<StreakCard> => streakRepo.setCompletion(await getDriver(), id, date, done, streakRepo.DEFAULT_CELL_DAYS);

export const listIdeas = async (opts?: { tag?: string; includePromoted?: boolean }): Promise<Idea[]> =>
	ideaRepo.list(await getDriver(), opts);
export const getIdea = async (id: number): Promise<Idea> => ideaRepo.get(await getDriver(), id);
export const createIdea = async (input: IdeaInput): Promise<Idea> =>
	ideaRepo.create(await getDriver(), input);
export const updateIdea = async (id: number, input: IdeaInput): Promise<Idea> =>
	ideaRepo.update(await getDriver(), id, input);
export const deleteIdea = async (id: number): Promise<void> => ideaRepo.remove(await getDriver(), id);
export const promoteIdea = async (id: number, goalId: number): Promise<Idea> =>
	ideaRepo.promote(await getDriver(), id, goalId);
export const listIdeaTags = async (): Promise<Tag[]> => ideaRepo.listTags(await getDriver());
