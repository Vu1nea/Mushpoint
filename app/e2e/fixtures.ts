import { expect, test as base, type Page } from '@playwright/test';
import { loadE2eEnv } from './env';
import { readUsers, runIdOf, type Who } from './users';

loadE2eEnv();

export { expect };

export function usernameFor(who: Who): string {
	return `e2e_${who}_${runIdOf(readUsers()[who])}`;
}

export const test = base.extend<{ signIn: (page: Page, who: Who) => Promise<void> }>({
	// eslint-disable-next-line no-empty-pattern
	signIn: async ({}, use) => {
		await use(async (page, who) => {
			const user = readUsers()[who];
			await page.goto('/login');
			await page.getByLabel('Email').fill(user.email);
			await page.getByLabel('Password').fill(process.env.E2E_PASSWORD ?? '');
			await page.getByRole('button', { name: 'Sign in' }).click();
			await page.waitForURL((url) => !url.pathname.startsWith('/login'));

			// A fresh account has no username yet and is sent to /welcome.
			if (new URL(page.url()).pathname === '/welcome') {
				await page.getByLabel('Username').fill(usernameFor(who));
				await page.getByRole('button', { name: 'Continue' }).click();
				await page.waitForURL((url) => url.pathname !== '/welcome');
			}
		});
	}
});
