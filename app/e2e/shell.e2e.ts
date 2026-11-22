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

test('a new user sees the stat strip and an empty message in every section', async ({ page }) => {
	await page.goto('/');

	await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
	await expect(page.getByRole('link', { name: 'New goal' })).toBeVisible();

	const summary = page.getByRole('group', { name: 'Summary' });
	for (const label of ['Active goals', 'Due today', 'Best streak (days)']) {
		await expect(summary.getByText(label)).toBeVisible();
	}
	await expect(summary.getByRole('definition').filter({ hasText: /^0$/ })).toHaveCount(3);

	for (const title of ['Tasks today', 'Streaks', 'Vision board', 'Goals', 'Upcoming']) {
		await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
	}
	for (const message of [
		'Nothing due today.',
		'No habits tracked yet.',
		/Nothing pinned yet/,
		'No active goals yet.',
		'Nothing due soon.'
	]) {
		await expect(page.getByText(message)).toBeVisible();
	}
});

test('the goals screen is one h1 over a table, with an empty message for a new user', async ({
	page
}) => {
	await page.goto('/goals');

	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Goals');
	await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
	await expect(page.getByRole('button', { name: 'New Goal' })).toBeVisible();
	await expect(page.getByRole('radiogroup', { name: 'Filter goals by status' })).toBeVisible();
	const table = page.getByRole('table', { name: 'Goals' });
	await expect(table.getByText(/No active goals here yet/)).toBeVisible();

	// The status filter is a segmented control that drives the URL.
	await page.getByRole('radio', { name: 'All' }).click();
	await expect(page).toHaveURL(/status=all/);
	await expect(table.getByText(/No goals here yet/)).toBeVisible();
});

test('a goal can be deleted from the list menu', async ({ page }, testInfo) => {
	test.skip(testInfo.project.name !== 'desktop', 'creates a goal; desktop project only');
	const title = `Delete goal ${crypto.randomUUID().slice(0, 8)}`;

	await page.goto('/goals');
	await page.getByRole('button', { name: 'New Goal' }).click();
	const form = page.getByRole('dialog', { name: 'New Goal' });
	await form.getByLabel('Title').fill(title);
	await form.getByRole('button', { name: 'Create' }).click();
	await expect(form).toBeHidden();

	const table = page.getByRole('table', { name: /goals$/ });
	const row = table.getByRole('row').filter({ hasText: title });
	await expect(row).toBeVisible();

	await row.getByRole('button', { name: `Actions for ${title}` }).click();
	await page.getByRole('menu').getByRole('menuitem', { name: 'Delete' }).click();

	const dialog = page.getByRole('dialog');
	await expect(dialog).toContainText('Its subgoals are removed.');
	await expect(dialog).toContainText('stay as standalone tasks');
	await dialog.getByRole('button', { name: 'Delete' }).click();
	await expect(dialog).toBeHidden();
	await expect(page.getByText(title)).toHaveCount(0);
});

test('the sidebar links to every built screen', async ({ page }) => {
	await page.goto('/goals');

	await expect(page.getByRole('link', { name: 'Goal Tracker' })).toBeVisible();

	await page.getByRole('link', { name: 'Task Manager' }).click();
	await expect(page).toHaveURL(/\/tasks/);
	await expect(page.getByRole('heading', { name: 'Tasks' })).toBeVisible();

	for (const [label, path] of [
		['Dashboard', /\/$/],
		['Idea Vault', /\/ideas/],
		['Vision Board', /\/vision-board/]
	] as const) {
		await page.getByRole('link', { name: label, exact: true }).click();
		await expect(page).toHaveURL(path);
	}

	await page.getByRole('link', { name: 'Settings' }).click();
	await expect(page).toHaveURL(/\/settings/);
	await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
});

test('the vision board is one h1 with an add action and an empty message for a new user', async ({
	page
}) => {
	await page.goto('/vision-board');

	await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Vision Board');
	await expect(page.getByRole('button', { name: 'Add Item', exact: true })).toBeVisible();
	await expect(page.getByText(/No vision items yet/)).toBeVisible();
	await expect(page.getByRole('button', { name: 'Add your first item' })).toBeVisible();
});

test('the tasks screen defaults to the list with its four columns', async ({ page }) => {
	await page.goto('/tasks');

	await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
	await expect(page.getByRole('tab', { name: 'List' })).toHaveAttribute('aria-selected', 'true');
	const table = page.getByRole('table', { name: 'Tasks' });
	for (const column of ['Task', 'Goal', 'Due', 'Status']) {
		// Goal and Due hide below the md breakpoint; assert them on desktop only.
		if (column === 'Goal' || column === 'Due') {
			if ((page.viewportSize()?.width ?? 0) < 768) continue;
		}
		await expect(table.getByRole('columnheader', { name: column, exact: true })).toBeVisible();
	}
	await expect(page.getByRole('searchbox', { name: 'Search tasks' })).toBeVisible();
});

test('the list filters by status, offers Edit and Delete, and contains a long title', async ({
	page
}, testInfo) => {
	test.skip(testInfo.project.name !== 'desktop', 'creates a task; desktop project only');
	const longTitle = `Long ${'x'.repeat(195)}`;
	expect(longTitle).toHaveLength(200);

	await page.goto('/tasks');
	await page.getByRole('button', { name: 'New Task' }).click();
	const drawer = page.getByRole('dialog', { name: 'New Task' });
	await drawer.getByLabel('Title').fill(longTitle);
	await drawer.getByRole('button', { name: 'Create' }).click();
	await expect(drawer).toBeHidden();

	const table = page.getByRole('table', { name: 'Tasks' });
	const row = table.getByRole('row').filter({ hasText: 'Long xxx' });
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
	await expect(table.getByRole('row').filter({ hasText: 'Long xxx' })).toHaveCount(0);
	await filter.getByRole('radio', { name: /^Done/ }).click();
	await expect(table.getByRole('row').filter({ hasText: 'Long xxx' })).toBeVisible();
	await filter.getByRole('radio', { name: /^All/ }).click();

	await page.getByRole('searchbox', { name: 'Search tasks' }).fill('no-such-task-zzz');
	await expect(table.getByText('No tasks match.')).toBeVisible();
	await page.getByRole('searchbox', { name: 'Search tasks' }).fill('');

	await table.getByRole('button', { name: /^Actions for Long/ }).click();
	const menu = page.getByRole('menu');
	await expect(menu.getByRole('menuitem', { name: 'Edit' })).toBeVisible();
	await menu.getByRole('menuitem', { name: 'Delete' }).click();

	// Clean up so later tests still see an empty account.
	await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
	await expect(table.getByRole('row').filter({ hasText: 'Long xxx' })).toHaveCount(0);
});

test('the task board shows all three columns', async ({ page }) => {
	await page.goto('/tasks');
	await page.getByRole('tab', { name: 'Board' }).click();

	for (const column of ['To do', 'In progress', 'Done']) {
		await expect(page.getByRole('heading', { name: column })).toBeVisible();
	}
});

test('the sidebar collapses to an icon rail', async ({ page }) => {
	await page.goto('/goals');
	const wordmark = page.getByText('Mushpoint', { exact: true });
	await expect(wordmark).toBeVisible();

	await page.getByRole('button', { name: 'Collapse', exact: true }).click();

	await expect(wordmark).toBeHidden();
	await expect(page.getByRole('link', { name: 'Goal Tracker' })).toBeVisible();
});

test('the theme picker offers both shipped themes', async ({ page }) => {
	await page.goto('/settings');
	await page.getByRole('tab', { name: 'Appearance' }).click();
	await expect(page).toHaveURL(/tab=appearance/);

	await expect(page.getByRole('button', { name: /Nocturne/ })).toBeVisible();
	await expect(page.getByRole('button', { name: /Coquette/ })).toBeVisible();
});

test('the settings screen offers the streak grace period', async ({ page }) => {
	await page.goto('/settings?tab=tracking');

	await expect(page.getByRole('heading', { name: 'Streaks' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Increase grace period' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Decrease grace period' })).toBeVisible();
});

test('the settings screen starts with the account section', async ({ page }) => {
	await page.goto('/settings');

	await expect(page.getByRole('tab', { name: 'Account' })).toHaveAttribute('aria-selected', 'true');
	await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
	await expect(page.getByLabel('Username')).toBeVisible();
	await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
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

test('Ctrl+K opens the command palette and Enter opens the first match', async ({
	page
}, testInfo) => {
	// The only mutating test in this file: one project, so one goal per run.
	test.skip(testInfo.project.name !== 'desktop', 'creates a goal; desktop project only');
	const title = `Palette goal ${crypto.randomUUID().slice(0, 8)}`;

	await page.goto('/goals');
	await page.getByRole('button', { name: 'New Goal' }).click();
	const form = page.getByRole('dialog', { name: 'New Goal' });
	await form.getByLabel('Title').fill(title);
	await form.getByRole('button', { name: 'Create' }).click();
	await expect(form).toBeHidden();

	await page.goto('/tasks');
	await page.keyboard.press('Control+k');
	const palette = page.getByRole('dialog', { name: 'Search' });
	await expect(palette).toBeVisible();

	await page.getByRole('combobox').fill(title);
	await expect(palette.getByRole('option', { name: new RegExp(title) })).toBeVisible();

	await page.keyboard.press('Enter');
	await expect(page).toHaveURL(/\/goals\/\d+$/);
	await expect(palette).toBeHidden();
});

test('the palette opens from the search button and Escape closes it', async ({ page }) => {
	await page.goto('/goals');

	const button = page.getByRole('button', { name: 'Search', exact: true });
	await button.click();
	const palette = page.getByRole('dialog', { name: 'Search' });
	await expect(palette).toBeVisible();
	await expect(palette.getByText('Type to search')).toBeVisible();

	await page.getByRole('combobox').fill('zzz-no-such-item');
	await expect(palette.getByText('No results')).toBeVisible();

	await page.keyboard.press('Escape');
	await expect(palette).toBeHidden();
	await expect(button).toBeFocused();
});

test('the ideas screen is one h1 over a table, with an empty message for a new user', async ({
	page
}) => {
	await page.goto('/ideas');

	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ideas');
	await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
	await expect(page.getByRole('button', { name: 'New Idea' })).toBeVisible();
	await expect(page.getByRole('searchbox', { name: 'Search ideas' })).toBeVisible();
	await expect(page.getByRole('table', { name: 'Ideas' }).getByText(/No ideas yet/)).toBeVisible();
});

test('ideas are rows with tag chips; search, tag filter and the row menu work', async ({
	page
}, testInfo) => {
	test.skip(testInfo.project.name !== 'desktop', 'creates ideas; desktop project only');
	const suffix = Math.random().toString(36).slice(2, 8);
	const title = `Idea ${suffix}`;
	const other = `Other ${suffix}`;
	const tag = `tag${suffix}`;

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

	// Clean up so later tests still see an empty account.
	await page.goto('/ideas');
	for (const name of [title, other]) {
		await table
			.getByRole('row')
			.filter({ hasText: name })
			.getByRole('button', { name: `Actions for ${name}` })
			.click();
		await page.getByRole('menu').getByRole('menuitem', { name: 'Delete' }).click();
		await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
		await expect(table.getByRole('row').filter({ hasText: name })).toHaveCount(0);
	}
});
