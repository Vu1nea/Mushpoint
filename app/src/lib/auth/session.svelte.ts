import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '$lib/api/error';
import type { AppConfig } from '$lib/config';

export type CallbackResult = 'signed_in' | 'recovery' | 'email_changed' | 'error';

/** The sign-in error that means "confirm your email first"; login offers a resend for it. */
export const EMAIL_NOT_CONFIRMED = 'Confirm your email first. Check your inbox.';

class AuthState {
	session = $state<Session | null>(null);
	readonly email = $derived(this.session?.user.email ?? null);
}

/** The signed-in user, kept in sync with Supabase's auth events. */
export const auth = new AuthState();

let client: SupabaseClient | null = null;
let unsubscribe: (() => void) | null = null;

/** Creates the Supabase client and starts tracking the session. */
export function initAuth(config: AppConfig): void {
	unsubscribe?.();
	client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
		// The callback page exchanges the code itself, so the URL is not parsed on load.
		auth: { flowType: 'pkce', persistSession: true, detectSessionInUrl: false }
	});
	const { data } = client.auth.onAuthStateChange((_event, session) => {
		auth.session = session;
	});
	unsubscribe = () => data.subscription.unsubscribe();
}

function supabase(): SupabaseClient {
	if (!client) throw new AppError('internal', 'Auth is not initialized');
	return client;
}

function toAppError(error: { code?: string; message: string }): AppError {
	switch (error.code) {
		case 'invalid_credentials':
			return AppError.validation('Email or password is incorrect.');
		case 'email_not_confirmed':
			return AppError.validation(EMAIL_NOT_CONFIRMED);
		default:
			return new AppError('unavailable', error.message);
	}
}

function check(result: { error: { code?: string; message: string } | null }): void {
	if (result.error) throw toAppError(result.error);
}

const callbackUrl = (type: string) => `${location.origin}/auth/callback?type=${type}`;

/** The current access token, refreshed by Supabase when it has expired. */
export async function getAccessToken(): Promise<string | null> {
	const { data, error } = await supabase().auth.getSession();
	// A failed refresh (e.g. a revoked refresh token) comes back as an error with
	// no session: that is a signed-out user, not a failure to surface.
	if (error && !data.session) {
		auth.session = null;
		return null;
	}
	auth.session = data.session;
	return data.session?.access_token ?? null;
}

export async function signUp(email: string, password: string): Promise<void> {
	check(
		await supabase().auth.signUp({
			email,
			password,
			options: { emailRedirectTo: callbackUrl('signup') }
		})
	);
}

export async function signIn(email: string, password: string): Promise<void> {
	const result = await supabase().auth.signInWithPassword({ email, password });
	check(result);
	auth.session = result.data.session;
}

export async function signOut(): Promise<void> {
	const result = await supabase().auth.signOut();
	auth.session = null;
	check(result);
}

export async function resendConfirmation(email: string): Promise<void> {
	check(
		await supabase().auth.resend({
			type: 'signup',
			email,
			options: { emailRedirectTo: callbackUrl('signup') }
		})
	);
}

export async function requestPasswordReset(email: string): Promise<void> {
	check(
		await supabase().auth.resetPasswordForEmail(email, { redirectTo: callbackUrl('recovery') })
	);
}

/** Finishes an email link (sign-up confirmation, password reset, email change). */
export async function completeCallback(url: URL): Promise<CallbackResult> {
	const code = url.searchParams.get('code');
	if (!code) return 'error';

	const result = await supabase().auth.exchangeCodeForSession(code);
	if (result.error) return 'error';
	auth.session = result.data.session;

	switch (url.searchParams.get('type')) {
		case 'recovery':
			return 'recovery';
		case 'email_change':
			return 'email_changed';
		default:
			return 'signed_in';
	}
}

export async function setNewPassword(password: string): Promise<void> {
	check(await supabase().auth.updateUser({ password }));
}
