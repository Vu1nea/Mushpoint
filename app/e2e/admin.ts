import { requireE2eEnv, serviceKeyHeaders } from './env';
import type { E2eUser } from './users';

/** Deletes users through the Supabase admin API. A 404 (already gone) is fine. */
export async function deleteUsers(users: E2eUser[]): Promise<void> {
	if (users.length === 0) return;
	const { url, serviceKey } = requireE2eEnv();
	const failures: string[] = [];
	for (const user of users) {
		try {
			const response = await fetch(`${url}/auth/v1/admin/users/${user.id}`, {
				method: 'DELETE',
				headers: serviceKeyHeaders(serviceKey)
			});
			if (!response.ok && response.status !== 404) {
				failures.push(`${user.email} (${response.status})`);
			}
		} catch (error) {
			failures.push(`${user.email} (${String(error)})`);
		}
	}
	if (failures.length > 0) {
		console.error(`E2E cleanup could not delete: ${failures.join(', ')}. Remove them by hand.`);
	}
}
