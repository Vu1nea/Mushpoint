import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { expect, test, usernameFor } from './fixtures';
import { readUsers } from './users';

// A 1x1 transparent PNG, built in code so no binary fixture is committed.
const PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
	'base64'
);

/*
 * Mutating checks for the app shell, run as user A (user B stays read-only so
 * its "new user" tests hold on every project). Each test makes its own data
 * under a random suffix and removes it in `finally`, so the serial account
 * journey below still sees an empty account.
 */

/** Deletes a row through its menu when it exists; a no-op when it is already gone. */
async function removeRow(page: Page, path: string, table: string | RegExp, title: string) {
	await page.goto(path);
	// The SPA renders its page only once its load has resolved; count after that.
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	const rows = page.getByRole('table', { name: table }).getByRole('row').filter({ hasText: title });
	if ((await rows.count()) === 0) return;
	await rows.getByRole('button', { name: `Actions for ${title}` }).click();
	await page.getByRole('menu').getByRole('menuitem', { name: 'Delete' }).click();
	await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
	await expect(rows).toHaveCount(0);
}

async function createGoal(page: Page, title: string) {
	await page.goto('/goals');
	await page.getByRole('button', { name: 'New Goal' }).click();
	const form = page.getByRole('dialog', { name: 'New Goal' });
	await form.getByLabel('Title').fill(title);
	await form.getByRole('button', { name: 'Create' }).click();
	await expect(form).toBeHidden();
}

test('a goal can be deleted from the list menu', async ({ page, signIn }) => {
	const title = `Delete goal ${crypto.randomUUID().slice(0, 8)}`;
	await signIn(page, 'a');
	try {
		await createGoal(page, title);

		const table = page.getByRole('table', { name: /goals$/ });
		const row = table.getByRole('row').filter({ hasText: title });
		await expect(row).toBeVisible();

		await row.getByRole('button', { name: `Actions for ${title}` }).click();
		await page.getByRole('menu').getByRole('menuitem', { name: 'Delete' }).click();

		const dialog = page.getByRole('alertdialog');
		await expect(dialog).toContainText('Its subgoals are removed.');
		await expect(dialog).toContainText('stay as standalone tasks');
		await dialog.getByRole('button', { name: 'Delete' }).click();
		await expect(dialog).toBeHidden();
		await expect(page.getByText(title)).toHaveCount(0);
	} finally {
		await removeRow(page, '/goals?status=all', /goals$/, title);
	}
});

test('the task list filters by status, offers Edit and Delete, and contains a long title', async ({
	page,
	signIn
}) => {
	const suffix = crypto.randomUUID().slice(0, 8);
	const prefix = `Long ${suffix} `;
	const longTitle = prefix + 'x'.repeat(200 - prefix.length);
	expect(longTitle).toHaveLength(200);
	const actions = new RegExp(`^Actions for Long ${suffix}`);
	await signIn(page, 'a');
	try {
		await page.goto('/tasks');
		await page.getByRole('button', { name: 'New Task', exact: true }).click();
		const drawer = page.getByRole('dialog', { name: 'New Task' });
		await drawer.getByLabel('Title').fill(longTitle);
		await drawer.getByRole('button', { name: 'Create' }).click();
		await expect(drawer).toBeHidden();

		const table = page.getByRole('table', { name: 'Tasks' });
		const row = table.getByRole('row').filter({ hasText: prefix });
		await expect(row).toBeVisible();

		// The sheet never scrolls sideways, at desktop width or phone width.
		for (const width of [1440, 390]) {
			await page.setViewportSize({ width, height: 900 });
			const overflow = await page.evaluate(
				() => document.documentElement.scrollWidth - document.documentElement.clientWidth
			);
			expect(overflow).toBeLessThanOrEqual(0);
		}
		await page.setViewportSize({ width: 1440, height: 900 });

		// Ticking the task done moves it out of the To do filter and into Done.
		await row.getByRole('checkbox').click();
		const filter = page.getByRole('radiogroup', { name: 'Filter tasks by status' });
		await filter.getByRole('radio', { name: /^To do/ }).click();
		await expect(table.getByRole('row').filter({ hasText: prefix })).toHaveCount(0);
		await filter.getByRole('radio', { name: /^Done/ }).click();
		await expect(table.getByRole('row').filter({ hasText: prefix })).toBeVisible();
		await filter.getByRole('radio', { name: /^All/ }).click();

		await page.getByRole('searchbox', { name: 'Search tasks' }).fill('no-such-task-zzz');
		await expect(table.getByText('No tasks match.')).toBeVisible();
		await page.getByRole('searchbox', { name: 'Search tasks' }).fill('');

		await table.getByRole('button', { name: actions }).click();
		const menu = page.getByRole('menu');
		await expect(menu.getByRole('menuitem', { name: 'Edit' })).toBeVisible();
		await menu.getByRole('menuitem', { name: 'Delete' }).click();
		await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
		await expect(table.getByRole('row').filter({ hasText: prefix })).toHaveCount(0);
	} finally {
		// The row is gone on the happy path; this only runs the delete if a step failed.
		await page.goto('/tasks');
		await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
		const leftover = page
			.getByRole('table', { name: 'Tasks' })
			.getByRole('row')
			.filter({ hasText: prefix });
		if ((await leftover.count()) > 0) {
			const filter = page.getByRole('radiogroup', { name: 'Filter tasks by status' });
			await filter.getByRole('radio', { name: /^All/ }).click();
			await leftover.getByRole('button', { name: actions }).click();
			await page.getByRole('menu').getByRole('menuitem', { name: 'Delete' }).click();
			await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
			await expect(leftover).toHaveCount(0);
		}
	}
});

test('Ctrl+K opens the command palette and Enter opens the first match', async ({
	page,
	signIn
}) => {
	const title = `Palette goal ${crypto.randomUUID().slice(0, 8)}`;
	await signIn(page, 'a');
	try {
		await createGoal(page, title);

		await page.goto('/tasks');
		// The SPA mounts the shell, and its Ctrl+K listener, only once the page's load
		// has resolved; a key pressed before that is lost.
		await expect(page.getByRole('heading', { level: 1, name: 'Tasks' })).toBeVisible();
		await page.keyboard.press('Control+k');
		const palette = page.getByRole('dialog', { name: 'Search' });
		await expect(palette).toBeVisible();

		await palette.getByRole('combobox').fill(title);
		await expect(palette.getByRole('option', { name: new RegExp(title) })).toBeVisible();

		await page.keyboard.press('Enter');
		await expect(page).toHaveURL(/\/goals\/\d+$/);
		await expect(palette).toBeHidden();
	} finally {
		await removeRow(page, '/goals?status=all', /goals$/, title);
	}
});

test('ideas are rows with tag chips; search, tag filter and the row menu work', async ({
	page,
	signIn
}) => {
	const suffix = Math.random().toString(36).slice(2, 8);
	const title = `Idea ${suffix}`;
	const other = `Other ${suffix}`;
	const tag = `tag${suffix}`;
	await signIn(page, 'a');
	try {
		await page.goto('/ideas');
		for (const [name, tags] of [
			[title, [tag, 'alpha']],
			[other, []]
		] as const) {
			await page.getByLabel('New idea title').fill(name);
			const tagField = page.getByLabel('Tags for the new idea');
			for (const t of tags) {
				await tagField.fill(t);
				await tagField.press('Enter');
			}
			await page.getByRole('button', { name: 'Add Idea' }).click();
			await expect(page.getByRole('table', { name: 'Ideas' }).getByText(name)).toBeVisible();
		}

		const table = page.getByRole('table', { name: 'Ideas' });
		const row = table.getByRole('row').filter({ hasText: title });
		await expect(row).toBeVisible();
		await expect(row.getByText(tag, { exact: true })).toBeVisible();

		// Search narrows the rows by title and by tag name; no match shows the empty message.
		const search = page.getByRole('searchbox', { name: 'Search ideas' });
		await search.fill(suffix.toUpperCase());
		await expect(table.getByRole('row').filter({ hasText: other })).toBeVisible();
		await search.fill(tag);
		await expect(table.getByRole('row').filter({ hasText: other })).toHaveCount(0);
		await expect(row).toBeVisible();
		await search.fill('no-such-idea-zzz');
		await expect(table.getByText('No ideas match.')).toBeVisible();
		await search.fill('');

		// The tag filter drives the URL.
		await page
			.getByRole('navigation', { name: 'Filter ideas by tag' })
			.getByRole('link', { name: tag, exact: true })
			.click();
		await expect(page).toHaveURL(/tag=/);
		await expect(table.getByRole('row').filter({ hasText: other })).toHaveCount(0);
		await expect(row).toBeVisible();

		await row.getByRole('button', { name: `Actions for ${title}` }).click();
		const menu = page.getByRole('menu');
		for (const item of ['Edit', 'Promote to goal', 'Delete']) {
			await expect(menu.getByRole('menuitem', { name: item })).toBeVisible();
		}
		await page.keyboard.press('Escape');
	} finally {
		for (const name of [title, other]) await removeRow(page, '/ideas', 'Ideas', name);
	}
});

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

	await test.step('A sees the goal as a table row and adds a subgoal on its detail page', async () => {
		await page.goto('/goals');
		await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
		const table = page.getByRole('table', { name: /goals$/ });
		for (const column of ['Goal', 'Category', 'Progress', 'Due']) {
			await expect(table.getByRole('columnheader', { name: column, exact: true })).toBeVisible();
		}
		const row = table.getByRole('row').filter({ hasText: 'E2E goal' });
		// Category has its own column.
		await expect(row).toContainText('Uncategorized');
		await expect(row.getByRole('link', { name: 'E2E goal' })).toHaveAttribute(
			'href',
			/\/goals\/\d+$/
		);

		await row.getByRole('link', { name: 'E2E goal' }).click();
		await expect(page).toHaveURL(/\/goals\/\d+$/);
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('E2E goal');

		const summary = page.getByRole('group', { name: 'Summary' });
		for (const label of ['Progress', 'Subgoals done', 'Tasks done', 'Due']) {
			await expect(summary).toContainText(label);
		}
		await expect(summary).toContainText('0/0');

		const subgoals = page.getByRole('list', { name: 'Subgoals' });
		await expect(subgoals).toHaveCount(0);
		await page.getByLabel('New subgoal', { exact: true }).fill('E2E subgoal');
		await page.keyboard.press('Enter');
		await expect(subgoals.getByRole('listitem')).toHaveCount(1);
		await expect(subgoals).toContainText('E2E subgoal');
		await expect(summary).toContainText('0/1');
	});

	await test.step('A creates a daily task and ticks it', async () => {
		await page.goto('/tasks');
		await page.getByRole('button', { name: 'New Task', exact: true }).click();
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

		// The dashboard lists the goal and the daily task in their own sections.
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
		await page.getByRole('button', { name: 'Add Item', exact: true }).click();
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
		await expect(page.getByRole('article', { name: /^Vision item 1 of 1$/ })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Edit vision item' })).toHaveCount(1);
	});

	await test.step('B, in a separate context, sees none of it', async () => {
		const context = await browser.newContext();
		try {
			const pageB = await context.newPage();
			await signIn(pageB, 'b');

			await pageB.goto('/goals');
			await expect(pageB.getByRole('heading', { name: 'Goals' })).toBeVisible();
			await expect(
				pageB.getByRole('table', { name: 'Goals' }).getByText(/goals here yet/)
			).toBeVisible();
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
