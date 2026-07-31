/** Mirrors the serde-serialized structs in src-tauri/src/models.rs. */

export type Timeframe = 'short' | 'mid' | 'long';
export type GoalStatus = 'active' | 'completed' | 'archived';
export type TaskStatus = 'todo' | 'in_progress' | 'done';

export const TIMEFRAMES: Timeframe[] = ['short', 'mid', 'long'];
export const GOAL_STATUSES: GoalStatus[] = ['active', 'completed', 'archived'];
export const TASK_STATUSES: TaskStatus[] = ['todo', 'in_progress', 'done'];

export const TIMEFRAME_LABELS: Record<Timeframe, string> = {
	short: 'Short term',
	mid: 'Mid term',
	long: 'Long term'
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
	todo: 'To do',
	in_progress: 'In progress',
	done: 'Done'
};

export const GOAL_STATUS_LABELS: Record<GoalStatus, string> = {
	active: 'Active',
	completed: 'Completed',
	archived: 'Archived'
};

export interface Category {
	id: number;
	name: string;
	colorToken: string | null;
	isDefault: boolean;
	createdAt: string;
}

export interface CategoryInput {
	name: string;
	colorToken: string | null;
}

export interface Goal {
	id: number;
	categoryId: number | null;
	title: string;
	description: string | null;
	timeframe: Timeframe;
	status: GoalStatus;
	dueDate: string | null;
	motivationText: string | null;
	motivationImagePath: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface GoalInput {
	categoryId: number | null;
	title: string;
	description: string | null;
	timeframe: Timeframe;
	dueDate: string | null;
	motivationText: string | null;
	motivationImagePath: string | null;
}

export interface Subgoal {
	id: number;
	goalId: number;
	title: string;
	dueDate: string | null;
	isComplete: boolean;
	position: number;
	createdAt: string;
	updatedAt: string;
}

export interface SubgoalInput {
	goalId: number;
	title: string;
	dueDate: string | null;
}

export interface SubgoalUpdate {
	title: string;
	dueDate: string | null;
	isComplete: boolean;
}

export interface Task {
	id: number;
	title: string;
	status: TaskStatus;
	dueDate: string | null;
	goalId: number | null;
	subgoalId: number | null;
	isRecurring: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface TaskInput {
	title: string;
	dueDate: string | null;
	goalId: number | null;
	subgoalId: number | null;
	isRecurring: boolean;
}

export interface TaskUpdate {
	title: string;
	status: TaskStatus;
	dueDate: string | null;
	goalId: number | null;
	subgoalId: number | null;
	isRecurring: boolean;
}

/** `progress` is a 0–1 ratio computed by the backend, never stored. */
export interface GoalSummary extends Goal {
	progress: number;
	subgoalCount: number;
	taskCount: number;
}

export interface SubgoalDetail extends Subgoal {
	progress: number;
	tasks: Task[];
}

export interface GoalDetail extends Goal {
	progress: number;
	category: Category | null;
	subgoals: SubgoalDetail[];
	directTasks: Task[];
}

export interface Settings {
	activeTheme: string;
	updatedAt: string;
}
