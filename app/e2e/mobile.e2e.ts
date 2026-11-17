import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';

/*
 * Phone-layout checks. Runs only in the iphone-13 and pixel-7 projects (see
 * playwright.config.ts). Below 768px the shell swaps the sidebar for a top bar,
 * a bottom tab bar and an account sheet opened from the avatar.
 *
 * Accessible names the shell must provide:
 *   - bottom tab bar:  <nav aria-label="Primary"> with links Dashboard, Goals, Tasks, Ideas, Vision
 *   - avatar button:   button named "Account menu"
 *   - account sheet:   role="dialog" named "Account", holding a "Settings" link and "Sign out"
 */

const ROUTES = ['/', '/goals', '/tasks', '/ideas', '/vision-board', '/settings'];

/** The narrowest phone the plan targets; each page is also checked at this width. */
const NARROW = { width: 375, height: 667 };

const TABS: { name: string; path: RegExp }[] = [
	{ name: 'Goals', path: /\/goals$/ },
	{ name: 'Tasks', path: /\/tasks$/ },
	{ name: 'Ideas', path: /\/ideas$/ },
	{ name: 'Vision', path: /\/vision-board$/ },
	{ name: 'Dashboard', path: /\/$/ }
];

function tabBar(page: Page) {
	return page.getByRole('navigation', { name: 'Primary' });
}

/** Waits for the route's data and the loading bar to settle so late content is measured. */
async function settle(page: Page): Promise<void> {
	await page.waitForLoadState('networkidle');
	await expect(page.getByRole('progressbar', { name: 'Loading' })).toBeHidden();
	await expect(page.getByRole('main')).toBeVisible();
}

async function expectNoHorizontalOverflow(page: Page, label: string): Promise<void> {
	const sizes = await page.evaluate(() => {
		const main = document.querySelector('main');
		return {
			docScroll: document.documentElement.scrollWidth,
			viewport: window.innerWidth,
			mainScroll: main?.scrollWidth ?? 0,
			mainClient: main?.clientWidth ?? 0
		};
	});
	expect(sizes.docScroll, `${label}: page wider than the viewport`).toBeLessThanOrEqual(
		sizes.viewport
	);
	expect(sizes.mainScroll, `${label}: <main> scrolls sideways`).toBeLessThanOrEqual(
		sizes.mainClient
	);
}

test.beforeEach(async ({ page, signIn }) => {
	await signIn(page, 'b');
});

for (const route of ROUTES) {
	test(`${route} has no horizontal overflow`, async ({ page }) => {
		await page.goto(route);
		await settle(page);
		await expectNoHorizontalOverflow(page, `${route} at device width`);

		await page.setViewportSize(NARROW);
		await settle(page);
		await expectNoHorizontalOverflow(page, `${route} at ${NARROW.width}px`);
	});
}

test('the desktop sidebar is hidden on phones', async ({ page }) => {
	await page.goto('/goals');
	await settle(page);

	await expect(page.getByRole('button', { name: 'Toggle sidebar' })).toBeHidden();
	await expect(page.getByRole('link', { name: 'Goal Tracker', exact: true })).toBeHidden();
	await expect(page.getByRole('link', { name: 'Task Manager', exact: true })).toBeHidden();
});

test('the bottom tab bar shows every main screen and navigates', async ({ page }) => {
	await page.goto('/');
	const nav = tabBar(page);
	await expect(nav).toBeVisible();

	for (const tab of TABS) {
		const link = nav.getByRole('link', { name: tab.name, exact: true });
		await expect(link).toBeVisible();
		await link.click();
		await expect(page).toHaveURL(tab.path);
		await expect(link).toHaveAttribute('aria-current', 'page');
	}
});

test('the bottom tab bar sits at the bottom of the viewport', async ({ page }) => {
	await page.goto('/tasks');
	const box = await tabBar(page).boundingBox();
	const viewport = page.viewportSize();
	expect(box).not.toBeNull();
	expect(viewport).not.toBeNull();
	// Allow for the safe-area inset under the bar.
	expect(box!.y + box!.height).toBeGreaterThan(viewport!.height - 40);
	expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height + 1);
});

test('the account sheet reaches Settings and closes on navigation', async ({ page }) => {
	await page.goto('/goals');

	await page.getByRole('button', { name: 'Account menu' }).click();
	const sheet = page.getByRole('dialog', { name: 'Account' });
	await expect(sheet).toBeVisible();

	await sheet.getByRole('link', { name: 'Settings', exact: true }).click();
	await expect(page).toHaveURL(/\/settings$/);
	await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
	await expect(sheet).toBeHidden();
});

test('Escape closes the account sheet', async ({ page }) => {
	await page.goto('/goals');

	await page.getByRole('button', { name: 'Account menu' }).click();
	const sheet = page.getByRole('dialog', { name: 'Account' });
	await expect(sheet).toBeVisible();

	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();
	await expect(page).toHaveURL(/\/goals$/);
});
