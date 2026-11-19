import { AppError } from './api/error';

export interface AppConfig {
	apiUrl: string;
	supabaseUrl: string;
	supabaseAnonKey: string;
}

const FIELDS = ['apiUrl', 'supabaseUrl', 'supabaseAnonKey'] as const;

let cached: Promise<AppConfig> | null = null;

async function fetchConfig(fetchFn: typeof fetch): Promise<AppConfig> {
	const res = await fetchFn('/config.json');
	if (!res.ok) throw new AppError('internal', `config.json could not be loaded (${res.status})`);
	const raw = (await res.json()) as Record<string, unknown>;
	for (const field of FIELDS) {
		if (typeof raw[field] !== 'string' || raw[field] === '') {
			throw new AppError('internal', `config.json is missing ${field}`);
		}
	}
	return {
		apiUrl: raw.apiUrl as string,
		supabaseUrl: raw.supabaseUrl as string,
		supabaseAnonKey: raw.supabaseAnonKey as string
	};
}

/** Fetches /config.json once and caches the result. A failure is not cached. */
export function loadConfig(fetchFn: typeof fetch = fetch): Promise<AppConfig> {
	if (!cached) {
		cached = fetchConfig(fetchFn).catch((e) => {
			cached = null;
			throw e;
		});
	}
	return cached;
}

/** Test hook. */
export function resetConfigCache() {
	cached = null;
}
