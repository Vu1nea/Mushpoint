import { request } from './http';
import type { Profile } from './types';

export const getProfile = (): Promise<Profile> => request('GET', '/profile');
export const setUsername = (username: string): Promise<Profile> =>
	request('PUT', '/profile/username', { username });
export const deleteAccount = (): Promise<void> => request('DELETE', '/account');
