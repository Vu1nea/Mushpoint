import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { AppError, UNREACHABLE_MESSAGE } from '$lib/api/error';
import type { AppConfig } from '$lib/config';

export type CallbackResult = 'signed_in' | 'recovery' | 'email_changed' | 'error';

/** The sign-in error that means "confirm your email first"; login offers a resend for it. */
export const EMAIL_NOT_CONFIRMED = 'Confirm your email first. Check your inbox.';

class AuthState {
	session = $state<Session | null>(null);
	readonly email = $derived(this.session?.user.email ?? null);
	/** The address an email change is waiting to be confirmed for, if any. */
	readonly pendingEmail = $derived(this.session?.user.new_email ?? null);
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

type SupabaseError = { code?: string; status?: number; name?: string; message: string };

/** Clearer wording for Supabase errors the user can act on. */
const REWORDED: Record<string, string> = {
	invalid_credentials: 'Email or password is incorrect.',
	email_not_confirmed: EMAIL_NOT_CONFIRMED,
	user_already_exists: 'An account with this email already exists. Sign in instead.',
	email_exists: 'An account with this email already exists. Sign in instead.',
	over_email_send_rate_limit: 'Too many emails sent. Wait a few minutes and try again.',
	over_request_rate_limit: 'Too many attempts. Wait a few minutes and try again.',
	same_password: 'Choose a password that is different from your current one.',
	email_address_invalid: 'Enter a valid email address.'
};

/** Codes that are the user's to fix even when no HTTP status came with them. */
const USER_FIXABLE = new Set([...Object.keys(REWORDED), 'weak_password']);

function toAppError(error: SupabaseError): AppError {
	// Supabase reports a request that never got an answer as a retryable fetch
	// error with status 0.
	if (error.name === 'AuthRetryableFetchError' || error.status === 0) {
		return new AppError('unavailable', UNREACHABLE_MESSAGE);
	}
	const fixable =
		(error.code !== undefined && USER_FIXABLE.has(error.code)) ||
		(error.status !== undefined && error.status >= 400 && error.status < 500);
	if (fixable) {
		return AppError.validation((error.code && REWORDED[error.code]) || error.message);
	}
	return new AppError('unavailable', error.message);
}

function check(result: { error: SupabaseError | null }): void {
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

/** Starts an email change; Supabase mails a confirmation link to both addresses. */
export async function changeEmail(newEmail: string): Promise<void> {
	check(
		await supabase().auth.updateUser(
			{ email: newEmail },
			{ emailRedirectTo: callbackUrl('email_change') }
		)
	);
}

/**
 * Changes the password after re-checking the current one, so a session left
 * open on a shared machine cannot be used to take over the account.
 */
export async function changePassword(current: string, next: string): Promise<void> {
	const email = auth.email;
	if (!email) throw AppError.unauthenticated('Sign in again to change your password.');

	const verify = await supabase().auth.signInWithPassword({ email, password: current });
	if (verify.error) {
		if (verify.error.code === 'invalid_credentials') {
			throw AppError.validation('Current password is incorrect.');
		}
		throw toAppError(verify.error);
	}
	check(await supabase().auth.updateUser({ password: next }));
}
