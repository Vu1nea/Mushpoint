import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		// The built files are served as-is with no Node server, so the app
		// ships as a static SPA: one fallback page, routing resolved in the client.
		adapter: adapter({ fallback: 'index.html' }),
		// Emitted as a <meta> CSP in the built page with a hash for SvelteKit's
		// inline bootstrap script, so no 'unsafe-inline' scripts are allowed.
		// frame-ancestors is ignored in <meta>; the web server sends it as a header.
		// Supabase is matched by wildcard because the project URL is runtime config;
		// a custom Supabase domain must be added here.
		csp: {
			mode: 'hash',
			directives: {
				'default-src': ['self'],
				'script-src': ['self'],
				// Svelte writes style attributes and transition styles at runtime.
				'style-src': ['self', 'unsafe-inline'],
				'img-src': ['self', 'data:', 'blob:', 'https://*.supabase.co'],
				'font-src': ['self'],
				'connect-src': ['self', 'https://*.supabase.co', 'wss://*.supabase.co'],
				'object-src': ['none'],
				'base-uri': ['self'],
				'form-action': ['self']
			}
		}
	}
};

export default config;
