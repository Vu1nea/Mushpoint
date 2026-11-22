import { request } from './http';
import type { Task, TaskInput, TaskStatus, TaskSummary, TaskUpdate } from './types';

export const listTasks = (): Promise<TaskSummary[]> => request('GET', '/tasks');
export const createTask = (input: TaskInput): Promise<Task> => request('POST', '/tasks', input);
export const updateTask = (id: number, input: TaskUpdate): Promise<Task> =>
	request('PUT', `/tasks/${id}`, input);
export const setTaskStatus = (id: number, status: TaskStatus): Promise<Task> =>
	request('PUT', `/tasks/${id}/status`, { status });
export const deleteTask = (id: number): Promise<void> => request('DELETE', `/tasks/${id}`);
