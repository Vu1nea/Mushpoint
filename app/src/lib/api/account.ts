import { imageForm } from '$lib/images';
import { request } from './http';
import type { Profile } from './types';

export const getProfile = (): Promise<Profile> => request('GET', '/profile');
export const setUsername = (username: string): Promise<Profile> =>
	request('PUT', '/profile/username', { username });
/** Checked like any image upload (type and 5 MB) before it is sent. */
export const setAvatar = async (file: File): Promise<Profile> =>
	request('PUT', '/profile/avatar', imageForm(file));
export const removeAvatar = (): Promise<Profile> => request('DELETE', '/profile/avatar');
export const deleteAccount = (): Promise<void> => request('DELETE', '/account');
