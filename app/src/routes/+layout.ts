import { redirect } from '@sveltejs/kit';
import { goto } from '$app/navigation';
import { deleteAccount, getProfile } from '$lib/api/account';
import { AppError } from '$lib/api/error';
import { configureHttp } from '$lib/api/http';
import type { Profile } from '$lib/api/types';
import { getAccessToken, initAuth, signOut } from '$lib/auth/session.svelte';
import { isPublicRoute } from '$lib/auth/routes';
import { loadConfig } from '$lib/config';

// The app is a static SPA that loads its data from the API in the browser,
// so nothing is server-rendered or prerendered.
export const ssr = false;
export const prerender = false;

const loginPath = (next: string) => '/login?next=' + encodeURIComponent(next);

/** Set while a sign-out + redirect to /login is underway, so parallel 401s run it once. */
let redirecting = false;
/** Layout loads in flight. They handle a 401 themselves with `redirect`. */
let loading = 0;

/** A request came back 401: drop the session and send the user to sign in. */
function onUnauthenticated() {
	if (redirecting || loading > 0 || isPublicRoute(location.pathname)) return;
	redirecting = true;
	const next = location.pathname + location.search;
	// A failed sign-out (offline) must not keep the user on a dead session.
	signOut()
		.catch(() => {})
		.then(() => goto(loginPath(next)))
		.finally(() => (redirecting = false));
}

let ready: Promise<void> | null = null;

/** Loads the runtime config and wires auth and the HTTP client, once per page load. */
function setup(): Promise<void> {
	ready ??= loadConfig()
		.then((config) => {
			initAuth(config);
			configureHttp({ apiUrl: config.apiUrl, getAccessToken, onUnauthenticated });
		})
		.catch((error) => {
			ready = null;
			throw error;
		});
	return ready;
}

/** The API's 401 message for a user whose account deletion has started. */
const ACCOUNT_DELETED = 'account deleted';

/**
 * The account is tombstoned but its login survived (the deletion failed
 * partway), so every request is refused. Retries the whole idempotent
 * deletion, signs out, and returns where to send the user.
 */
async function finishDeletion(): Promise<string> {
	let done = true;
	try {
		await deleteAccount();
	} catch {
		done = false;
	}
	await signOut().catch(() => {});
	return done ? '/login?deleted=1' : '/login?deleted=pending';
}

/**
 * `error` is set when the profile could not be loaded for a reason other than an
 * expired session (e.g. the API is down); the layout then shows it with a retry
 * instead of the app. It is not thrown: SvelteKit renders a root error page by
 * re-running this load, which would fail the same way.
 */
interface LayoutData {
	profile: Profile | null;
	error: unknown;
}

export const load = async ({ url }): Promise<LayoutData> => {
	await setup();
	const signedIn = (await getAccessToken()) !== null;
	const path = url.pathname;

	if (!signedIn) {
		if (!isPublicRoute(path)) redirect(307, loginPath(path + url.search));
		return { profile: null, error: null };
	}
	if (path === '/login' || path === '/signup') redirect(307, '/');

	let profile: Profile;
	loading++;
	try {
		profile = await getProfile();
	} catch (error) {
		if (error instanceof AppError && error.kind === 'unauthenticated') {
			if (error.message === ACCOUNT_DELETED) redirect(307, await finishDeletion());
			await signOut().catch(() => {});
			redirect(307, loginPath(path + url.search));
		}
		return { profile: null, error };
	} finally {
		loading--;
	}

	// A username is chosen once, on /welcome, before anything else.
	if (profile.username === null && path !== '/welcome') redirect(307, '/welcome');
	if (profile.username !== null && path === '/welcome') redirect(307, '/');
	return { profile, error: null };
};
