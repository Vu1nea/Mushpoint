import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const ENV_FILE = resolve(APP_ROOT, '.env.e2e');
export const USERS_FILE = resolve(APP_ROOT, 'e2e', '.users.json');

export const REQUIRED_VARS = [
	'E2E_SUPABASE_URL',
	'E2E_SUPABASE_SERVICE_KEY',
	'E2E_PASSWORD'
] as const;

/** Loads `.env.e2e` into `process.env` when it exists. Never throws, so listing tests works without it. */
export function loadE2eEnv(): void {
	if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);
}

/** Loads `.env.e2e` and returns the required values, or throws naming what is missing. */
export function requireE2eEnv(): { url: string; serviceKey: string; password: string } {
	loadE2eEnv();
	const missing = REQUIRED_VARS.filter((name) => !process.env[name]);
	if (missing.length > 0) {
		const hint = existsSync(ENV_FILE)
			? `${ENV_FILE} is missing a value for`
			: `${ENV_FILE} does not exist (copy .env.e2e.example to .env.e2e); missing`;
		throw new Error(`E2E setup: ${hint} ${missing.join(', ')}.`);
	}
	return {
		url: process.env.E2E_SUPABASE_URL!.replace(/\/+$/, ''),
		serviceKey: process.env.E2E_SUPABASE_SERVICE_KEY!,
		password: process.env.E2E_PASSWORD!
	};
}

/** Legacy `service_role` keys are JWTs and also go in `Authorization`. New
 * `sb_secret_...` keys are not JWTs and go in `apikey` only. */
export function serviceKeyHeaders(key: string): Record<string, string> {
	return key.startsWith('sb_') ? { apikey: key } : { apikey: key, Authorization: `Bearer ${key}` };
}
