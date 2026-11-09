import { isRedirect } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '$lib/api/error';

const m = vi.hoisted(() => ({
	goto: vi.fn(async () => {}),
	getProfile: vi.fn(),
	configureHttp: vi.fn(),
	getAccessToken: vi.fn(),
	initAuth: vi.fn(),
	signOut: vi.fn(async () => {}),
	loadConfig: vi.fn(async () => ({ apiUrl: '/api', supabaseUrl: 'u', supabaseAnonKey: 'k' }))
}));

vi.mock('$app/navigation', () => ({ goto: m.goto }));
vi.mock('$lib/api/account', () => ({ getProfile: m.getProfile }));
vi.mock('$lib/api/http', () => ({ configureHttp: m.configureHttp }));
vi.mock('$lib/config', () => ({ loadConfig: m.loadConfig }));
vi.mock('$lib/auth/session.svelte', () => ({
	getAccessToken: m.getAccessToken,
	initAuth: m.initAuth,
	signOut: m.signOut
}));

const { load } = await import('./+layout');

const run = (href: string) => load({ url: new URL(href, 'http://app.test') } as never);

async function redirectOf(promise: Promise<unknown>) {
	try {
		await promise;
	} catch (e) {
		if (isRedirect(e)) return { status: e.status, location: e.location };
		throw e;
	}
	throw new Error('expected a redirect');
}

/** The onUnauthenticated handler the layout gave the HTTP client. */
const onUnauthenticated = () =>
	(m.configureHttp.mock.calls[0][0] as { onUnauthenticated: () => void }).onUnauthenticated;

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
	m.goto.mockClear();
	m.signOut.mockClear();
	m.getProfile.mockReset();
	m.getAccessToken.mockReset();
	vi.stubGlobal('location', { pathname: '/tasks', search: '?view=kanban' });
});

describe('root layout load', () => {
	it('sends a signed-out visitor to /login with the full path as next', async () => {
		m.getAccessToken.mockResolvedValue(null);
		await expect(redirectOf(run('/tasks?view=kanban'))).resolves.toEqual({
			status: 307,
			location: '/login?next=%2Ftasks%3Fview%3Dkanban'
		});
	});

	it('lets a signed-out visitor see public routes', async () => {
		m.getAccessToken.mockResolvedValue(null);
		await expect(run('/login')).resolves.toEqual({ profile: null, error: null });
	});

	it('sends a signed-in user away from /login', async () => {
		m.getAccessToken.mockResolvedValue('tok');
		await expect(redirectOf(run('/login'))).resolves.toEqual({ status: 307, location: '/' });
	});

	it('returns the profile when signed in', async () => {
		m.getAccessToken.mockResolvedValue('tok');
		m.getProfile.mockResolvedValue({ username: 'mush' });
		await expect(run('/goals')).resolves.toEqual({ profile: { username: 'mush' }, error: null });
	});

	it('signs out and redirects to /login when the profile request is unauthenticated', async () => {
		m.getAccessToken.mockResolvedValue('tok');
		m.getProfile.mockRejectedValue(AppError.unauthenticated('expired'));
		await expect(redirectOf(run('/goals/3'))).resolves.toEqual({
			status: 307,
			location: '/login?next=%2Fgoals%2F3'
		});
		expect(m.signOut).toHaveBeenCalledOnce();
	});

	it('returns the error instead of throwing when the API is unavailable', async () => {
		m.getAccessToken.mockResolvedValue('tok');
		const down = new AppError('unavailable', 'down');
		m.getProfile.mockRejectedValue(down);
		await expect(run('/goals')).resolves.toEqual({ profile: null, error: down });
		expect(m.signOut).not.toHaveBeenCalled();
	});
});

describe('onUnauthenticated', () => {
	it('signs out and redirects once for parallel 401s, keeping the query', async () => {
		onUnauthenticated()();
		onUnauthenticated()();
		onUnauthenticated()();
		await flush();
		expect(m.signOut).toHaveBeenCalledOnce();
		expect(m.goto).toHaveBeenCalledOnce();
		expect(m.goto).toHaveBeenCalledWith('/login?next=%2Ftasks%3Fview%3Dkanban');
	});

	it('runs again for a later 401 once the redirect finished', async () => {
		onUnauthenticated()();
		await flush();
		onUnauthenticated()();
		await flush();
		expect(m.goto).toHaveBeenCalledTimes(2);
	});

	it('does nothing on a public route', async () => {
		vi.stubGlobal('location', { pathname: '/login', search: '?next=%2Ftasks' });
		onUnauthenticated()();
		await flush();
		expect(m.signOut).not.toHaveBeenCalled();
		expect(m.goto).not.toHaveBeenCalled();
	});

	it('leaves a 401 during the layout load to the load', async () => {
		m.getAccessToken.mockResolvedValue('tok');
		let fail!: (e: unknown) => void;
		m.getProfile.mockReturnValue(new Promise((_, reject) => (fail = reject)));
		const pending = redirectOf(run('/goals'));
		await flush();
		onUnauthenticated()();
		fail(AppError.unauthenticated('expired'));
		await pending;
		await flush();
		expect(m.goto).not.toHaveBeenCalled();
		expect(m.signOut).toHaveBeenCalledOnce();
	});
});
