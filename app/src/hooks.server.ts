import type { Handle } from '@sveltejs/kit';

/**
 * Runs once at build time, when adapter-static renders the SPA fallback page
 * (there is no server in production). Adds `<link rel="preload">` for the two
 * web fonts so the browser fetches them alongside the CSS instead of after it.
 * SvelteKit preloads JS and CSS by default; fonts are opt-in.
 */
export const handle: Handle = ({ event, resolve }) =>
	resolve(event, {
		preload: ({ type }) => type === 'js' || type === 'css' || type === 'font'
	});
