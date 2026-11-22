import { request } from './http';
import type { Category, CategoryInput } from './types';

export const listCategories = (): Promise<Category[]> => request('GET', '/categories');
export const createCategory = (input: CategoryInput): Promise<Category> =>
	request('POST', '/categories', input);
export const updateCategory = (id: number, input: CategoryInput): Promise<Category> =>
	request('PUT', `/categories/${id}`, input);
export const deleteCategory = (id: number): Promise<void> => request('DELETE', `/categories/${id}`);
