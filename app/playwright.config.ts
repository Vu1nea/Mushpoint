import { defineConfig } from '@playwright/test';
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
	testMatch: '**/*.e2e.{ts,js}'
});
