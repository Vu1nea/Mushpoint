import { AppError, type ErrorKind } from './error';

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

interface HttpOptions {
	apiUrl: string;
	getAccessToken: () => Promise<string | null>;
	onUnauthenticated: () => void;
	fetch?: typeof fetch;
}

let opts: HttpOptions | null = null;
let markConfigured!: (options: HttpOptions) => void;
/**
 * Resolves with the options once `configureHttp` has run. SvelteKit runs page
 * loads in parallel with the root layout load that configures the client, so a
 * request made first waits here instead of failing. It never rejects: if setup
 * fails, the layout shows its error view and waiting requests stay pending.
 */
const configured = new Promise<HttpOptions>((resolve) => (markConfigured = resolve));

export function configureHttp(options: HttpOptions): void {
	opts = { ...options, apiUrl: options.apiUrl.replace(/\/+$/, '') };
	markConfigured(opts);
}

export async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
	const {
		apiUrl,
		getAccessToken,
		onUnauthenticated,
		fetch: customFetch
	} = opts ?? (await configured);
	const doFetch = customFetch ?? fetch;

	const headers = new Headers({ 'X-Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone });
	let token: string | null;
	try {
		token = await getAccessToken();
	} catch {
		onUnauthenticated();
		throw AppError.unauthenticated('Your session has expired. Please sign in again.');
	}
	if (token) headers.set('Authorization', `Bearer ${token}`);

	let payload: BodyInit | undefined;
	if (body instanceof FormData) {
		payload = body;
	} else if (body !== undefined) {
		headers.set('Content-Type', 'application/json');
		payload = JSON.stringify(body);
	}

	let res: Response;
	try {
		res = await doFetch(apiUrl + path, { method, headers, body: payload });
	} catch {
		throw new AppError(
			'unavailable',
			'Could not reach Mushpoint. Check your connection and try again.'
		);
	}

	if (res.ok) {
		if (res.status === 204) return undefined as T;
		try {
			return (await res.json()) as T;
		} catch {
			throw new AppError('internal', `unexpected response (${res.status})`);
		}
	}

	let err: AppError;
	try {
		const data = (await res.json()) as { kind?: unknown; message?: unknown };
		if (typeof data?.kind !== 'string' || typeof data.message !== 'string') throw new Error();
		err = new AppError(data.kind as ErrorKind, data.message);
	} catch {
		err = new AppError('internal', `unexpected response (${res.status})`);
	}

	if (res.status === 401) {
		onUnauthenticated();
		if (err.kind !== 'unauthenticated') err = AppError.unauthenticated(err.message);
	}
	throw err;
}
