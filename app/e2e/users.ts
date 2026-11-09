import { readFileSync } from 'node:fs';
import { USERS_FILE } from './env';

export type Who = 'a' | 'b';
export interface E2eUser {
	id: string;
	email: string;
}
export type E2eUsers = Record<Who, E2eUser>;

export function readUsers(): E2eUsers {
	return JSON.parse(readFileSync(USERS_FILE, 'utf8')) as E2eUsers;
}

/** The run id embedded in a throwaway email, `e2e-a-<runId>@example.com`. */
export function runIdOf(user: E2eUser): string {
	const match = /^e2e-[ab]-(.+)@example\.com$/.exec(user.email);
	if (!match) throw new Error(`Unexpected e2e email: ${user.email}`);
	return match[1];
}
