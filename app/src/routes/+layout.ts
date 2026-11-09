import { redirect } from '@sveltejs/kit';
import { goto } from '$app/navigation';
import { getProfile } from '$lib/api/account';
import { configureHttp } from '$lib/api/http';
import { getAccessToken, initAuth, signOut } from '$lib/auth/session.svelte';
import { isPublicRoute } from '$lib/auth/routes';
import { loadConfig } from '$lib/config';

// The app is a static SPA that loads its data from the API in the browser,
// so nothing is server-rendered or prerendered.
export const ssr = false;
export const prerender = false;

let ready: Promise<void> | null = null;

/** Loads the runtime config and wires auth and the HTTP client, once per page load. */
function setup(): Promise<void> {
	ready ??= loadConfig()
		.then((config) => {
			initAuth(config);
			configureHttp({
				apiUrl: config.apiUrl,
				getAccessToken,
				onUnauthenticated: () => {
					// A failed sign-out (offline) must not keep the user on a dead session.
					signOut()
						.catch(() => {})
						.then(() => goto('/login?next=' + encodeURIComponent(location.pathname)));
				}
			});
		})
		.catch((error) => {
			ready = null;
			throw error;
		});
	return ready;
}

export const load = async ({ url }) => {
	await setup();
	const signedIn = (await getAccessToken()) !== null;
	const path = url.pathname;

	if (!signedIn) {
		if (!isPublicRoute(path)) redirect(307, '/login?next=' + encodeURIComponent(path + url.search));
		return { profile: null };
	}
	if (path === '/login' || path === '/signup') redirect(307, '/');
	return { profile: await getProfile() };
};
