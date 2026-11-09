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
		adapter: adapter({ fallback: 'index.html' })
	}
};

export default config;
