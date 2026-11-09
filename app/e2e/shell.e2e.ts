import { expect, test } from './fixtures';

/*
 * App-shell checks against the real build and API. Each test signs in as the
 * throwaway user B first; the CRUD flow lives in web.e2e.ts.
 */

test.beforeEach(async ({ page, signIn }) => {
	await signIn(page, 'b');
});

test('the root route lands on the Dashboard', async ({ page }) => {
	await page.goto('/');

	await expect(page).toHaveURL(/\/$/);
	await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
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
	const wordmark = page.getByText('Mushpoint', { exact: true });
	await expect(wordmark).toBeVisible();

	await page.getByRole('button', { name: 'Toggle sidebar' }).click();

	await expect(wordmark).toBeHidden();
	await expect(page.getByRole('link', { name: 'Goal Tracker' })).toBeVisible();
});

test('the theme picker offers both shipped themes', async ({ page }) => {
	await page.goto('/settings');

	await expect(page.getByRole('button', { name: /Nocturne/ })).toBeVisible();
	await expect(page.getByRole('button', { name: /Coquette/ })).toBeVisible();
});

test('the settings screen offers the streak grace period', async ({ page }) => {
	await page.goto('/settings');

	await expect(page.getByRole('heading', { name: 'Streaks' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Increase grace period' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Decrease grace period' })).toBeVisible();
});

test('the settings screen starts with the account section', async ({ page }) => {
	await page.goto('/settings');

	await expect(page.getByRole('heading', { name: 'Account' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Delete account' })).toBeVisible();
});

test('the task drawer offers every cadence', async ({ page }) => {
	await page.goto('/tasks');
	await page.getByRole('button', { name: 'New Task' }).click();

	await page.getByRole('combobox', { name: 'Repeats' }).click();
	for (const option of ["Doesn't repeat", 'Daily', 'Weekdays', 'Weekly']) {
		await expect(page.getByRole('option', { name: option })).toBeVisible();
	}
});
