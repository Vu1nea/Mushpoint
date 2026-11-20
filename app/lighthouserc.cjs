/*
 * Lighthouse CI over the signed-out pages of the static build: a secondary
 * accessibility signal next to the axe e2e suite (which also covers signed-in
 * pages). Needs `npm run build` and a build/config.json first; CI copies
 * static/config.example.json, since these pages never call Supabase on load.
 */
module.exports = {
	ci: {
		collect: {
			// --single serves index.html for unknown paths, like nginx's SPA fallback.
			startServerCommand: 'npx --yes sirv-cli@3 build --single --port 4173',
			startServerReadyPattern: 'Local',
			url: [
				'http://localhost:4173/login',
				'http://localhost:4173/signup',
				'http://localhost:4173/forgot-password'
			],
			numberOfRuns: 1,
			settings: {
				onlyCategories: ['accessibility', 'best-practices'],
				chromeFlags: '--headless=new --no-sandbox'
			}
		},
		assert: {
			assertions: {
				'categories:accessibility': ['error', { minScore: 1 }],
				'categories:best-practices': ['warn', { minScore: 0.9 }]
			}
		},
		upload: { target: 'filesystem', outputDir: '.lighthouseci' }
	}
};
