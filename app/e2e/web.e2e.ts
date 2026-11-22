import { readFileSync } from 'node:fs';
import { expect, test, usernameFor } from './fixtures';
import { readUsers } from './users';

// A 1x1 transparent PNG, built in code so no binary fixture is committed.
const PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
	'base64'
);

test('two users: A builds data and deletes the account, B never sees it', async ({
	page,
	browser,
	signIn
}) => {
	const users = readUsers();
	const password = process.env.E2E_PASSWORD ?? '';

	await test.step('A signs in and picks a username', async () => {
		await signIn(page, 'a');
		await page.goto('/settings');
		await expect(page.getByLabel('Username')).toHaveValue(usernameFor('a'));
	});

	await test.step('A creates a goal', async () => {
		await page.goto('/goals');
		await page.getByRole('button', { name: 'New Goal' }).click();
		const dialog = page.getByRole('dialog', { name: 'New Goal' });
		await dialog.getByLabel('Title').fill('E2E goal');
		await dialog.getByRole('button', { name: 'Create' }).click();
		await expect(dialog).toBeHidden();
		await expect(page.getByText('E2E goal', { exact: true })).toBeVisible();
	});

	await test.step('A creates a daily task and ticks it', async () => {
		await page.goto('/tasks');
		await page.getByRole('button', { name: 'New Task' }).click();
		const dialog = page.getByRole('dialog', { name: 'New Task' });
		await dialog.getByLabel('Title').fill('E2E task');
		// A daily task is due today, so it shows up with a checkbox on the dashboard.
		await dialog.getByRole('combobox', { name: 'Repeats' }).click();
		await page.getByRole('option', { name: 'Daily' }).click();
		await dialog.getByRole('button', { name: 'Create' }).click();
		await expect(dialog).toBeHidden();
		await expect(page.getByText('E2E task').first()).toBeVisible();

		await page.goto('/');
		const checkbox = page.getByRole('checkbox', { name: 'Mark E2E task done' });
		await expect(checkbox).not.toBeChecked();
		await checkbox.click();
		// Optimistic: checked straight away, before the server round trip settles.
		await expect(checkbox).toBeChecked({ timeout: 1000 });

		// The flat dashboard counts the goal and the daily task in its stat strip.
		const summary = page.getByRole('group', { name: 'Summary' });
		await expect(summary).toContainText('Active goals');
		await expect(page.getByRole('table', { name: 'Active goals' })).toContainText('E2E goal');
		await expect(page.getByRole('table', { name: 'Tasks due today' })).toContainText('E2E task');
		// The daily task is a habit, so its streak row carries the completion heatmap.
		await expect(
			page
				.getByRole('listitem')
				.filter({ hasText: 'E2E task' })
				.getByRole('img', { name: /Completion history/ })
		).toBeVisible();
	});

	await test.step('A uploads an image to the vision board', async () => {
		await page.goto('/vision-board');
		await page.getByRole('button', { name: 'Add to Vision Board' }).click();
		const dialog = page.getByRole('dialog', { name: 'New Vision Item' });
		await dialog.locator('input[type="file"]').setInputFiles({
			name: 'e2e.png',
			mimeType: 'image/png',
			buffer: PNG
		});
		// Either the preview appears or the dialog shows why the upload failed;
		// report that message instead of a bare "img not found".
		const preview = dialog.locator('img');
		const failure = dialog.getByRole('alert');
		await expect(preview.or(failure)).toBeVisible({ timeout: 15_000 });
		if (await failure.isVisible()) {
			throw new Error(`Vision image upload failed: ${await failure.innerText()}`);
		}
		await dialog.getByRole('button', { name: 'Create' }).click();
		await expect(dialog).toBeHidden();
		await expect(page.locator('main img')).toHaveCount(1);
	});

	await test.step('B, in a separate context, sees none of it', async () => {
		const context = await browser.newContext();
		try {
			const pageB = await context.newPage();
			await signIn(pageB, 'b');

			await pageB.goto('/goals');
			await expect(pageB.getByRole('heading', { name: 'Goals' })).toBeVisible();
			await expect(pageB.getByText(/goals here yet/)).toBeVisible();
			await expect(pageB.getByText('E2E goal')).toHaveCount(0);

			await pageB.goto('/tasks');
			await expect(pageB.getByRole('heading', { name: 'Tasks' })).toBeVisible();
			await pageB.getByRole('tab', { name: 'Board' }).click();
			await expect(pageB.getByRole('heading', { name: 'To do' })).toBeVisible();
			await expect(pageB.getByText('E2E task')).toHaveCount(0);

			await pageB.goto('/vision-board');
			await expect(pageB.getByText('No vision items yet')).toBeVisible();
			await expect(pageB.locator('main img')).toHaveCount(0);
		} finally {
			await context.close();
		}
	});

	await test.step('A downloads a copy of their data', async () => {
		await page.goto('/settings');
		const [download] = await Promise.all([
			page.waitForEvent('download'),
			page.getByRole('button', { name: 'Download my data' }).click()
		]);
		expect(download.suggestedFilename()).toMatch(/^mushpoint-export-\d{4}-\d{2}-\d{2}\.json$/);
		const file = JSON.parse(readFileSync(await download.path(), 'utf8'));
		expect(file).toMatchObject({ format: 'mushpoint-export', signInEmail: users.a.email });
		expect(file.tables.goals.map((g: { title: string }) => g.title)).toEqual(['E2E goal']);
		expect(file.tables.tasks.map((t: { title: string }) => t.title)).toEqual(['E2E task']);
		expect(file.tables.task_completions).toHaveLength(1);
		expect(file.images).toHaveLength(1);
		expect(file.images[0].url).toMatch(/^https:/);
		expect(JSON.stringify(file)).not.toContain(usernameFor('b'));
	});

	await test.step('A deletes the account and cannot sign in again', async () => {
		await page.goto('/settings');
		await page.getByRole('button', { name: 'Delete account' }).click();
		const dialog = page.getByRole('alertdialog');
		const confirm = dialog.getByRole('button', { name: 'Delete account' });
		await expect(confirm).toBeDisabled();
		await dialog.getByLabel('Type your email to confirm').fill(users.a.email);
		await expect(confirm).toBeEnabled();
		await confirm.click();

		await expect(page).toHaveURL(/\/login\?deleted=1/);
		await expect(page.getByText('Your account was deleted.')).toBeVisible();

		await page.getByLabel('Email').fill(users.a.email);
		await page.getByLabel('Password', { exact: true }).fill(password);
		await page.getByRole('button', { name: 'Sign in' }).click();
		await expect(page.getByRole('alert')).toBeVisible();
		await expect(page).toHaveURL(/\/login/);
	});
});
