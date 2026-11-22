import { readFileSync } from 'node:fs';
import { USERS_FILE } from './env';

export type Who = 'a' | 'b';
export interface E2eUser {
	id: string;
	email: string;
}
export type E2eUsers = Record<Who, E2eUser>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const E2E_EMAIL = /^e2e-[ab]-.+@example\.com$/;

function parseUser(value: unknown, who: Who): E2eUser {
	const { id, email } = (value ?? {}) as Partial<E2eUser>;
	if (
		typeof id !== 'string' ||
		!UUID.test(id) ||
		typeof email !== 'string' ||
		!E2E_EMAIL.test(email)
	) {
		throw new Error(`${USERS_FILE}: invalid entry for user "${who}". Delete it and rerun setup.`);
	}
	return { id, email };
}

/** Reads the users written by global setup. Validates the shape so a stale or
 * hand-edited file can never point cleanup at anything but a throwaway user. */
export function readUsers(): E2eUsers {
	const raw = JSON.parse(readFileSync(USERS_FILE, 'utf8')) as Record<Who, unknown>;
	return { a: parseUser(raw.a, 'a'), b: parseUser(raw.b, 'b') };
}

/** The run id embedded in a throwaway email, `e2e-a-<runId>@example.com`. */
export function runIdOf(user: E2eUser): string {
	const match = /^e2e-[ab]-(.+)@example\.com$/.exec(user.email);
	if (!match) throw new Error(`Unexpected e2e email: ${user.email}`);
	return match[1];
}
