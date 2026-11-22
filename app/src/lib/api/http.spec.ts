import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from './error';
import { configureHttp, request } from './http';

const onUnauthenticated = vi.fn();
let fetchMock: ReturnType<typeof vi.fn>;

function setup(token: string | null = 'tok') {
	configureHttp({
		apiUrl: 'http://api.test/api/',
		getAccessToken: async () => token,
		onUnauthenticated,
		fetch: fetchMock as unknown as typeof fetch
	});
}

function json(status: number, body: unknown) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json' }
	});
}

beforeEach(() => {
	onUnauthenticated.mockReset();
	fetchMock = vi.fn();
	setup();
});

describe('request', () => {
	it('sends auth, timezone and builds the url', async () => {
		fetchMock.mockResolvedValue(json(200, { ok: true }));
		await expect(request('GET', '/x')).resolves.toEqual({ ok: true });
		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe('http://api.test/api/x');
		const h = new Headers(init.headers);
		expect(h.get('authorization')).toBe('Bearer tok');
		expect(h.get('x-timezone')).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
	});

	it('rejects unauthenticated without calling the API when there is no token', async () => {
		setup(null);
		await expect(request('GET', '/x')).rejects.toMatchObject({ kind: 'unauthenticated' });
		expect(onUnauthenticated).not.toHaveBeenCalled();
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('sends JSON bodies with content-type', async () => {
		fetchMock.mockResolvedValue(json(200, {}));
		await request('POST', '/x', { a: 1 });
		const init = fetchMock.mock.calls[0][1];
		expect(new Headers(init.headers).get('content-type')).toBe('application/json');
		expect(init.body).toBe('{"a":1}');
	});

	it('sends FormData as-is without content-type', async () => {
		fetchMock.mockResolvedValue(json(200, {}));
		const fd = new FormData();
		fd.append('f', 'v');
		await request('POST', '/x', fd);
		const init = fetchMock.mock.calls[0][1];
		expect(init.body).toBe(fd);
		expect(new Headers(init.headers).has('content-type')).toBe(false);
	});

	it('resolves undefined on 204', async () => {
		fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
		await expect(request('DELETE', '/x')).resolves.toBeUndefined();
	});

	it('maps error bodies to AppError', async () => {
		fetchMock.mockResolvedValue(json(400, { kind: 'validation', message: 'bad' }));
		const err = await request('POST', '/x', {}).catch((e) => e);
		expect(err).toBeInstanceOf(AppError);
		expect(err).toMatchObject({ kind: 'validation', message: 'bad' });
	});

	it('401 calls onUnauthenticated once and rejects unauthenticated', async () => {
		fetchMock.mockResolvedValue(json(401, { kind: 'unauthenticated', message: 'no' }));
		await expect(request('GET', '/x')).rejects.toMatchObject({ kind: 'unauthenticated' });
		expect(onUnauthenticated).toHaveBeenCalledTimes(1);
	});

	it('maps network failure to unavailable', async () => {
		fetchMock.mockRejectedValue(new TypeError('fetch failed'));
		await expect(request('GET', '/x')).rejects.toMatchObject({
			kind: 'unavailable',
			message: 'Could not reach Mushpoint. Check your connection and try again.'
		});
	});

	it('maps non-JSON error bodies to internal', async () => {
		fetchMock.mockResolvedValue(new Response('<html>bad gateway</html>', { status: 502 }));
		await expect(request('GET', '/x')).rejects.toMatchObject({
			kind: 'internal',
			message: 'unexpected response (502)'
		});
	});

	it('maps a 2xx non-JSON body to internal', async () => {
		fetchMock.mockResolvedValue(new Response('<html>ok</html>', { status: 200 }));
		await expect(request('GET', '/x')).rejects.toMatchObject({
			kind: 'internal',
			message: 'unexpected response (200)'
		});
	});

	it('treats a failing token getter as unauthenticated', async () => {
		configureHttp({
			apiUrl: '/api',
			getAccessToken: async () => {
				throw new Error('boom');
			},
			onUnauthenticated,
			fetch: fetchMock as unknown as typeof fetch
		});
		await expect(request('GET', '/x')).rejects.toMatchObject({ kind: 'unauthenticated' });
		expect(onUnauthenticated).not.toHaveBeenCalled();
		expect(fetchMock).not.toHaveBeenCalled();
	});
});

describe('request before configureHttp', () => {
	it('waits for configureHttp instead of failing', async () => {
		vi.resetModules();
		const fresh = await import('./http');
		const fetchLater = vi.fn().mockResolvedValue(json(200, { ok: 1 }));
		let settled = false;
		const pending = fresh.request('GET', '/x').finally(() => (settled = true));
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(settled).toBe(false);
		expect(fetchLater).not.toHaveBeenCalled();
		fresh.configureHttp({
			apiUrl: 'http://api.test/api',
			getAccessToken: async () => 'tok',
			onUnauthenticated,
			fetch: fetchLater as unknown as typeof fetch
		});
		await expect(pending).resolves.toEqual({ ok: 1 });
		expect(fetchLater.mock.calls[0][0]).toBe('http://api.test/api/x');
	});
});
