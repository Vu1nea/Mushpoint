import { defineConfig, devices } from '@playwright/test';
import { loadE2eEnv } from './e2e/env';

// Workers import this file too, so they inherit E2E_PASSWORD from .env.e2e.
loadE2eEnv();

export default defineConfig({
	globalSetup: './e2e/global-setup.ts',
	globalTeardown: './e2e/global-teardown.ts',
	webServer: [
		{
			// The Express API; the preview server proxies /api to it.
			command: 'npm --prefix ../server run dev',
			url: 'http://localhost:3000/api/healthz',
			reuseExistingServer: true,
			timeout: 60_000
		},
		{
			command: 'npm run build && npm run preview',
			port: 4173,
			timeout: 180_000
		}
	],
	testMatch: '**/*.e2e.{ts,js}',
	// One retry on CI only: every test signs in against a live Supabase project,
	// and a slow sign-in on a shared runner (seen on Firefox) is not a code bug.
	retries: process.env.CI ? 1 : 0,
	// Set explicitly: Playwright only infers baseURL from a single webServer, and
	// there are two, so page.goto('/login') would have no host.
	use: { baseURL: 'http://localhost:4173' },
	// CI uploads app/playwright-report when the job fails.
	reporter: process.env.CI ? [['dot'], ['html', { open: 'never' }]] : 'list',
	projects: [
		{
			// No `use` overrides: the same Desktop Chromium defaults the suite ran with before projects.
			name: 'desktop',
			testIgnore: '**/mobile.e2e.{ts,js}'
		},
		{
			// iPhone 13 viewport, touch, DPR and UA, emulated on Chromium so the suite needs one browser.
			name: 'iphone-13',
			testMatch: '**/mobile.e2e.{ts,js}',
			use: { ...devices['iPhone 13'], browserName: 'chromium' }
		},
		{
			name: 'pixel-7',
			testMatch: '**/mobile.e2e.{ts,js}',
			use: { ...devices['Pixel 7'] }
		},
		// The app shell on the other two engines. Only shell.e2e: it signs in as
		// user B and reads. web.e2e deletes user A's account (users are made once
		// per run), so it can run in one project only. The axe scan stays on
		// Chromium (its rules check the DOM, not the engine).
		{
			name: 'firefox',
			testMatch: '**/shell.e2e.{ts,js}',
			use: { ...devices['Desktop Firefox'] }
		},
		{
			name: 'webkit',
			testMatch: '**/shell.e2e.{ts,js}',
			use: { ...devices['Desktop Safari'] }
		}
	]
});
