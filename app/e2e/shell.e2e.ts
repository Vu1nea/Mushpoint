import { expect, test } from '@playwright/test';

/*
 * These run against the plain web build, where no Tauri backend exists. That
 * limits them to the app shell and the "backend missing" path — CRUD flows are
 * covered by the Rust tests until a Tauri-driven harness lands (see
 * plans/playwright-test-plan.md).
 */

test('the root route lands on Goals', async ({ page }) => {
	await page.goto('/');

	await expect(page).toHaveURL(/\/goals/);
	await expect(page.getByRole('heading', { name: 'Goals' })).toBeVisible();
});

test('the sidebar links to every built screen', async ({ page }) => {
	await page.goto('/goals');

	await expect(page.getByRole('link', { name: 'Goal Tracker' })).toBeVisible();

	await page.getByRole('link', { name: 'Task Manager' }).click();
	await expect(page).toHaveURL(/\/tasks/);
	await expect(page.getByRole('heading', { name: 'Tasks' })).toBeVisible();

	await page.getByRole('link', { name: 'Settings' }).click();
	await expect(page).toHaveURL(/\/settings/);
	await expect(page.getByRole('heading', { name: 'Theme' })).toBeVisible();
});

test('the task board shows all three columns', async ({ page }) => {
	await page.goto('/tasks');

	for (const column of ['To do', 'In progress', 'Done']) {
		await expect(page.getByRole('heading', { name: column })).toBeVisible();
	}
});

test('the sidebar collapses to an icon rail', async ({ page }) => {
	await page.goto('/goals');
	const wordmark = page.getByText('Mushpoint');
	await expect(wordmark).toBeVisible();

	await page.getByRole('button', { name: 'Toggle sidebar' }).click();

	await expect(wordmark).toBeHidden();
	await expect(page.getByRole('link', { name: 'Goal Tracker' })).toBeVisible();
});

test('a missing backend is reported instead of failing silently', async ({ page }) => {
	await page.goto('/goals');

	const alert = page.getByRole('alert');
	await expect(alert).toContainText('Backend not running');
	await expect(alert).toContainText('npm run tauri dev');
});

test('the theme picker offers both shipped themes', async ({ page }) => {
	await page.goto('/settings');

	await expect(page.getByRole('button', { name: /Nocturne/ })).toBeVisible();
	await expect(page.getByRole('button', { name: /Coquette/ })).toBeVisible();
});
