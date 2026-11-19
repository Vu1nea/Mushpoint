import { writeFileSync } from 'node:fs';
import { USERS_FILE, requireE2eEnv } from './env';
import { deleteUsers } from './admin';
import type { E2eUsers, Who } from './users';

export default async function globalSetup(): Promise<void> {
	const { url, serviceKey, password } = requireE2eEnv();
	// Short and lowercase so it fits the username pattern (3-30 letters, digits, _ and .).
	const runId = Date.now().toString(36);

	const created: Partial<E2eUsers> = {};
	try {
		for (const who of ['a', 'b'] as Who[]) {
			const email = `e2e-${who}-${runId}@example.com`;
			const response = await fetch(`${url}/auth/v1/admin/users`, {
				method: 'POST',
				headers: {
					apikey: serviceKey,
					Authorization: `Bearer ${serviceKey}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ email, password, email_confirm: true })
			});
			if (!response.ok) {
				throw new Error(
					`E2E setup: creating ${email} failed (${response.status}): ${await response.text()}`
				);
			}
			const body = (await response.json()) as { id: string };
			created[who] = { id: body.id, email };
		}
	} catch (error) {
		// Teardown does not run when setup throws, so remove what was made.
		await deleteUsers(Object.values(created));
		throw error;
	}

	writeFileSync(USERS_FILE, JSON.stringify(created, null, '\t'));
}
