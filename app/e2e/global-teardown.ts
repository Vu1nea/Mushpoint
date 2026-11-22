import { existsSync, rmSync } from 'node:fs';
import { USERS_FILE } from './env';
import { deleteUsers } from './admin';
import { readUsers } from './users';

export default async function globalTeardown(): Promise<void> {
	if (!existsSync(USERS_FILE)) return;
	try {
		const users = readUsers();
		await deleteUsers([users.a, users.b]);
	} finally {
		rmSync(USERS_FILE, { force: true });
	}
}
