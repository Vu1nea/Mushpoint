/*
 * Lighthouse CI over the signed-out pages of the static build: a secondary
 * accessibility signal next to the axe e2e suite (which also covers signed-in
 * pages), plus a performance score and a page-weight budget. Needs
 * `npm run build` and a build/config.json first; CI copies
 * static/config.example.json, since these pages never call Supabase on load.
 */
module.exports = {
	ci: {
		collect: {
			// --single serves index.html for unknown paths, like nginx's SPA fallback;
			// --gzip serves the build's precompressed .gz files, like nginx's gzip_static.
			startServerCommand: 'npx --yes sirv-cli@3 build --single --gzip --port 4173',
			startServerReadyPattern: 'Local',
			url: [
				'http://localhost:4173/login',
				'http://localhost:4173/signup',
				'http://localhost:4173/forgot-password'
			],
			numberOfRuns: 1,
			settings: {
				onlyCategories: ['accessibility', 'best-practices', 'performance'],
				chromeFlags: '--headless=new --no-sandbox'
			}
		},
		assert: {
			assertions: {
				'categories:accessibility': ['error', { minScore: 1 }],
				'categories:best-practices': ['warn', { minScore: 0.9 }],
				// Score varies with the runner, so it only warns (0.94 locally on nginx).
				'categories:performance': ['warn', { minScore: 0.9 }],
				// Bytes on the wire are stable, so these fail the build. A signed-out
				// page is about 250 KB (fonts ~115 KB); the 1024 px mascot PNG alone
				// used to be 433 KB, the kind of regression this catches.
				'resource-summary:total:size': ['error', { maxNumericValue: 500 * 1024 }],
				'resource-summary:image:size': ['error', { maxNumericValue: 50 * 1024 }]
			}
		},
		upload: { target: 'filesystem', outputDir: '.lighthouseci' }
	}
};
