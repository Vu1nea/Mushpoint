import { request } from './http';
import type { VisionItemInput } from './types';
import type { VisionItemView } from './viewTypes';

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
