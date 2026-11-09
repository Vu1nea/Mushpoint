import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppConfig } from '$lib/config';

type FakeSession = { access_token: string; user: { email: string } };

const supabase = vi.hoisted(() => {
	let session: { access_token: string; user: { email: string; new_email?: string } } | null = null;
	const listeners: ((event: string, s: typeof session) => void)[] = [];
	const setSession = (next: typeof session, event: string) => {
		session = next;
		for (const listener of listeners) listener(event, next);
	};
	const auth = {
		getSession: vi.fn(async () => ({ data: { session }, error: null })),
		onAuthStateChange: vi.fn((cb: (event: string, s: typeof session) => void) => {
			listeners.push(cb);
			return { data: { subscription: { unsubscribe: vi.fn() } } };
		}),
		signInWithPassword: vi.fn(async ({ email }: { email: string; password: string }) => {
			setSession({ access_token: 'tok-1', user: { email } }, 'SIGNED_IN');
			return { data: { session }, error: null as unknown };
		}),
		signOut: vi.fn(async () => {
			setSession(null, 'SIGNED_OUT');
			return { error: null };
		}),
		exchangeCodeForSession: vi.fn(async () => {
			setSession({ access_token: 'tok-2', user: { email: 'a@b.c' } }, 'SIGNED_IN');
			return { data: { session }, error: null };
		}),
		updateUser: vi.fn(async () => ({ data: { user: null }, error: null }))
	};
	return {
		auth,
		emit: setSession,
		reset() {
			session = null;
			listeners.length = 0;
		}
	};
});

vi.mock('@supabase/supabase-js', () => ({
	createClient: vi.fn(() => ({ auth: supabase.auth }))
}));

const {
	initAuth,
	getAccessToken,
	signIn,
	signOut,
	completeCallback,
	changeEmail,
	changePassword,
	auth
} = await import('./session.svelte');
const { createClient } = await import('@supabase/supabase-js');

const config: AppConfig = {
	apiUrl: '/api',
	supabaseUrl: 'https://proj.supabase.co',
	supabaseAnonKey: 'anon'
};

beforeEach(() => {
	supabase.reset();
	vi.clearAllMocks();
	initAuth(config);
});

describe('session', () => {
	it('creates a PKCE client that persists the session and ignores the URL', () => {
		expect(createClient).toHaveBeenCalledWith('https://proj.supabase.co', 'anon', {
			auth: { flowType: 'pkce', persistSession: true, detectSessionInUrl: false }
		});
	});

	it('has no access token without a session', async () => {
		await expect(getAccessToken()).resolves.toBeNull();
	});

	it('returns the access token after signIn and tracks the session', async () => {
		await signIn('me@example.com', 'secret-pass');
		await expect(getAccessToken()).resolves.toBe('tok-1');
		expect(auth.email).toBe('me@example.com');
		expect((auth.session as FakeSession | null)?.access_token).toBe('tok-1');
	});

	it('treats a failed refresh (error, no session) as signed out', async () => {
		await signIn('me@example.com', 'secret-pass');
		supabase.auth.getSession.mockResolvedValueOnce({
			data: { session: null },
			error: { code: 'refresh_token_not_found', message: 'Invalid Refresh Token' }
		} as never);
		await expect(getAccessToken()).resolves.toBeNull();
		expect(auth.session).toBeNull();
	});

	it('clears the token on signOut', async () => {
		await signIn('me@example.com', 'secret-pass');
		await signOut();
		await expect(getAccessToken()).resolves.toBeNull();
		expect(auth.session).toBeNull();
		expect(auth.email).toBeNull();
	});

	it('maps invalid_credentials to a validation error', async () => {
		supabase.auth.signInWithPassword.mockResolvedValueOnce({
			data: { session: null },
			error: { code: 'invalid_credentials', message: 'Invalid login credentials' }
		});
		await expect(signIn('me@example.com', 'wrong')).rejects.toMatchObject({
			kind: 'validation',
			message: 'Email or password is incorrect.'
		});
	});

	it('maps email_not_confirmed to a validation error', async () => {
		supabase.auth.signInWithPassword.mockResolvedValueOnce({
			data: { session: null },
			error: { code: 'email_not_confirmed', message: 'Email not confirmed' }
		});
		await expect(signIn('me@example.com', 'x')).rejects.toMatchObject({
			kind: 'validation',
			message: 'Confirm your email first. Check your inbox.'
		});
	});

	it('maps unknown server-side Supabase errors to unavailable with their message', async () => {
		supabase.auth.signInWithPassword.mockResolvedValueOnce({
			data: { session: null },
			error: { code: 'unexpected_failure', status: 500, message: 'Something broke' }
		});
		await expect(signIn('me@example.com', 'x')).rejects.toMatchObject({
			kind: 'unavailable',
			message: 'Something broke'
		});
	});

	it.each([
		[
			'weak_password',
			422,
			'Password should be at least 8 characters.',
			'Password should be at least 8 characters.'
		],
		[
			'user_already_exists',
			422,
			'User already registered',
			'An account with this email already exists. Sign in instead.'
		],
		[
			'over_email_send_rate_limit',
			429,
			'email rate limit exceeded',
			'Too many emails sent. Wait a few minutes and try again.'
		],
		[
			'over_request_rate_limit',
			429,
			'Request rate limit reached',
			'Too many attempts. Wait a few minutes and try again.'
		],
		[
			'same_password',
			422,
			'New password should be different.',
			'Choose a password that is different from your current one.'
		],
		['email_address_invalid', 400, 'Email address is invalid', 'Enter a valid email address.']
	])('maps %s to a validation error', async (code, status, message, expected) => {
		supabase.auth.signInWithPassword.mockResolvedValueOnce({
			data: { session: null },
			error: { code, status, message }
		});
		await expect(signIn('me@example.com', 'x')).rejects.toMatchObject({
			kind: 'validation',
			message: expected
		});
	});

	it('maps any other 4xx Supabase error to validation with its message', async () => {
		supabase.auth.signInWithPassword.mockResolvedValueOnce({
			data: { session: null },
			error: {
				code: 'signup_disabled',
				status: 422,
				message: 'Signups not allowed for this instance'
			}
		});
		await expect(signIn('me@example.com', 'x')).rejects.toMatchObject({
			kind: 'validation',
			message: 'Signups not allowed for this instance'
		});
	});

	it('maps a failed fetch to unavailable with a readable message', async () => {
		const offline = Object.assign(new Error('Failed to fetch'), {
			name: 'AuthRetryableFetchError',
			status: 0
		});
		supabase.auth.signInWithPassword.mockResolvedValueOnce({
			data: { session: null },
			error: offline
		});
		await expect(signIn('me@example.com', 'x')).rejects.toMatchObject({
			kind: 'unavailable',
			message: 'Could not reach Mushpoint. Check your connection and try again.'
		});
	});

	it('exchanges the code on a recovery callback', async () => {
		const result = await completeCallback(new URL('http://x/auth/callback?type=recovery&code=c'));
		expect(supabase.auth.exchangeCodeForSession).toHaveBeenCalledWith('c');
		expect(result).toBe('recovery');
	});

	it('returns error when the callback has no code', async () => {
		await expect(completeCallback(new URL('http://x/auth/callback?type=signup'))).resolves.toBe(
			'error'
		);
		expect(supabase.auth.exchangeCodeForSession).not.toHaveBeenCalled();
	});

	it('changePassword rejects a wrong current password without updating', async () => {
		await signIn('me@example.com', 'secret-pass');
		supabase.auth.signInWithPassword.mockResolvedValueOnce({
			data: { session: null },
			error: { code: 'invalid_credentials', message: 'Invalid login credentials' }
		});
		await expect(changePassword('wrong', 'newpass123')).rejects.toMatchObject({
			kind: 'validation',
			message: 'Current password is incorrect.'
		});
		expect(supabase.auth.signInWithPassword).toHaveBeenLastCalledWith({
			email: 'me@example.com',
			password: 'wrong'
		});
		expect(supabase.auth.updateUser).not.toHaveBeenCalled();
	});

	it('changePassword re-verifies the current password, then updates it', async () => {
		await signIn('me@example.com', 'secret-pass');
		await changePassword('secret-pass', 'newpass123');
		expect(supabase.auth.signInWithPassword).toHaveBeenLastCalledWith({
			email: 'me@example.com',
			password: 'secret-pass'
		});
		expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: 'newpass123' });
	});

	it('changePassword refuses without a signed-in email', async () => {
		auth.session = null;
		await expect(changePassword('x', 'newpass123')).rejects.toMatchObject({
			kind: 'unauthenticated'
		});
		expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled();
		expect(supabase.auth.updateUser).not.toHaveBeenCalled();
	});

	it('exposes a pending email change until it is confirmed', async () => {
		await signIn('old@example.com', 'pw');
		expect(auth.pendingEmail).toBeNull();
		supabase.emit(
			{ access_token: 'tok-1', user: { email: 'old@example.com', new_email: 'new@example.com' } },
			'USER_UPDATED'
		);
		expect(auth.pendingEmail).toBe('new@example.com');
		supabase.emit({ access_token: 'tok-1', user: { email: 'new@example.com' } }, 'USER_UPDATED');
		expect(auth.pendingEmail).toBeNull();
		expect(auth.email).toBe('new@example.com');
	});

	it('changeEmail redirects the confirmation links to the email_change callback', async () => {
		vi.stubGlobal('location', { origin: 'http://app.test' });
		try {
			await changeEmail('new@example.com');
		} finally {
			vi.unstubAllGlobals();
		}
		expect(supabase.auth.updateUser).toHaveBeenCalledWith(
			{ email: 'new@example.com' },
			{ emailRedirectTo: 'http://app.test/auth/callback?type=email_change' }
		);
	});
});
