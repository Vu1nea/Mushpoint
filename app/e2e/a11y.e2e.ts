import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

/*
 * Automated WCAG 2.2 A/AA checks with axe-core on every screen, in both
 * themes. Automation finds roughly a third of real issues; the manual
 * keyboard and screen-reader passes in TODO.md still apply.
 */

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const THEMES = ['nocturne', 'coquette'] as const;

const PUBLIC_ROUTES = ['/login', '/signup', '/forgot-password'];
const SIGNED_IN_ROUTES = [
	'/',
	'/goals',
	'/tasks',
	'/ideas',
	'/vision-board',
	'/settings',
	'/settings?tab=appearance',
	'/settings?tab=tracking'
];

async function useTheme(page: Page, theme: (typeof THEMES)[number]) {
	await page.evaluate((name) => {
		document.documentElement.dataset.theme = name;
	}, theme);
}

async function expectNoViolations(page: Page) {
	const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
	// One line per rule and node, so a failure names exactly what to fix.
	const report = violations.flatMap((v) =>
		v.nodes.map((n) => `${v.id} (${v.impact}): ${n.target.join(' ')} - ${v.help}`)
	);
	expect(report).toEqual([]);
}

for (const theme of THEMES) {
	test.describe(`signed out, ${theme}`, () => {
		for (const route of PUBLIC_ROUTES) {
			test(`${route} has no axe violations`, async ({ page }) => {
				await page.goto(route);
				await page.waitForLoadState('networkidle');
				await useTheme(page, theme);
				await expectNoViolations(page);
			});
		}
	});

	test.describe(`signed in, ${theme}`, () => {
		test.beforeEach(async ({ page, signIn }) => {
			await signIn(page, 'b');
		});

		for (const route of SIGNED_IN_ROUTES) {
			test(`${route} has no axe violations`, async ({ page }) => {
				await page.goto(route);
				await page.waitForLoadState('networkidle');
				await useTheme(page, theme);
				await expectNoViolations(page);
			});
		}
	});
}
