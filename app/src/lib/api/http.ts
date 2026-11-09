import { AppError, type ErrorKind } from './error';

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

interface HttpOptions {
	apiUrl: string;
	getAccessToken: () => Promise<string | null>;
	onUnauthenticated: () => void;
	fetch?: typeof fetch;
}

let opts: HttpOptions | null = null;

export function configureHttp(options: HttpOptions): void {
	opts = options;
}

export async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
	if (!opts) throw new AppError('internal', 'HTTP client is not configured');
	const { apiUrl, getAccessToken, onUnauthenticated } = opts;
	const doFetch = opts.fetch ?? fetch;

	const headers = new Headers({ 'X-Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone });
	const token = await getAccessToken();
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
		return (await res.json()) as T;
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
