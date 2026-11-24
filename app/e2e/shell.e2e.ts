import { expect, test } from './fixtures';

/*
 * App-shell checks against the real build and API. Each test signs in as the
 * throwaway user B first and only reads, so B stays empty on every project.
 * Anything that creates data (goals, tasks, ideas, palette search) lives in
 * web.e2e.ts as user A.
 */

test.beforeEach(async ({ page, signIn }) => {
	await signIn(page, 'b');
});

test('the root route lands on the Dashboard', async ({ page }) => {
	await page.goto('/');

	await expect(page).toHaveURL(/\/$/);
	await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
});

test('a new user sees an empty message in every dashboard section', async ({ page }) => {
	await page.goto('/');

	await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
	await expect(page.getByRole('textbox', { name: 'Quick-add title' })).toBeVisible();

	for (const title of [
		'Tasks today',
		'Streaks',
		'Vision board',
		'Goals',
		'Overdue',
		'Done on time',
		'Upcoming'
	]) {
		// SectionHeader puts its count inside the heading, so match the title as a prefix.
		await expect(page.getByRole('heading', { name: new RegExp(`^${title}`) })).toBeVisible();
	}
	for (const message of [
		'Nothing due today.',
		'No habits tracked yet.',
		/Nothing pinned yet/,
		'No active goals yet.',
		'Nothing overdue.',
		/No tasks were due in this period/,
		'Nothing due this month.'
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

test('the settings screen is one h1 over flat sections headed in order', async ({ page }) => {
	const sections: [string, string[]][] = [
		['/settings', ['Profile', 'Password', 'Your data', 'Danger zone']],
		['/settings?tab=appearance', ['Theme']],
		['/settings?tab=tracking', ['Categories', 'Streaks']]
	];
	for (const [path, titles] of sections) {
		await page.goto(path);
		await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
		await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
		await expect(page.getByRole('heading', { level: 2 })).toHaveText(
			titles.map((title) => new RegExp(`^${title}`))
		);
	}
});

test('the task drawer offers every cadence', async ({ page }) => {
	await page.goto('/tasks');
	await page.getByRole('button', { name: 'New Task', exact: true }).click();

	await page.getByRole('combobox', { name: 'Repeats' }).click();
	for (const option of ["Doesn't repeat", 'Daily', 'Weekdays', 'Weekly']) {
		await expect(page.getByRole('option', { name: option })).toBeVisible();
	}
});

test('the palette opens from the search button and Escape closes it', async ({ page }) => {
	// The search button sits in the dashboard header.
	await page.goto('/');

	const button = page.getByRole('button', { name: 'Search', exact: true });
	await button.click();
	const palette = page.getByRole('dialog', { name: 'Search' });
	await expect(palette).toBeVisible();
	await expect(palette.getByText('Type to search')).toBeVisible();

	await palette.getByRole('combobox').fill('zzz-no-such-item');
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
	await expect(page.getByRole('button', { name: 'Add Idea' })).toBeVisible();
	await expect(page.getByRole('searchbox', { name: 'Search ideas' })).toBeVisible();
	await expect(page.getByRole('table', { name: 'Ideas' }).getByText(/No ideas yet/)).toBeVisible();
});
