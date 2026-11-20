import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

/*
 * WCAG 1.4.10 Reflow and 1.4.4 Resize text: content fits a 320 CSS px wide
 * viewport without scrolling sideways. A 1280 px window at 400% zoom is 320 CSS
 * px and at 200% is 640, so both widths stand in for browser zoom. Boards that
 * scroll inside their own container (kanban, Gantt) are allowed by the
 * criterion's two-dimensional exception; only the page itself must not.
 */

const WIDTHS = [320, 640];
const PUBLIC_ROUTES = ['/login', '/signup', '/forgot-password'];
const SIGNED_IN_ROUTES = ['/', '/goals', '/tasks', '/ideas', '/vision-board', '/settings'];

/** Elements that stick out past the right edge, outside any scroll container. */
async function overflowReport(page: Page): Promise<string[]> {
	return page.evaluate(() => {
		const width = document.documentElement.clientWidth;
		const scrollsSideways = (el: Element | null) => {
			for (let node = el; node && node !== document.body; node = node.parentElement) {
				const overflow = getComputedStyle(node).overflowX;
				if (overflow === 'auto' || overflow === 'scroll' || overflow === 'hidden') return true;
			}
			return false;
		};
		const out: string[] = [];
		if (document.documentElement.scrollWidth > width) {
			out.push(`page scrolls sideways: ${document.documentElement.scrollWidth}px > ${width}px`);
		}
		for (const el of document.body.querySelectorAll('*')) {
			const rect = el.getBoundingClientRect();
			if (rect.width === 0 || rect.right <= width + 1) continue;
			if (scrollsSideways(el.parentElement)) continue;
			const name = el.tagName.toLowerCase() + (el.id ? `#${el.id}` : '');
			const label = (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 40);
			out.push(`${name} "${label}" ends at ${Math.round(rect.right)}px`);
		}
		return out.slice(0, 10);
	});
}

for (const width of WIDTHS) {
	test.describe(`${width} px wide`, () => {
		test.use({ viewport: { width, height: 720 } });

		for (const route of PUBLIC_ROUTES) {
			test(`${route} reflows`, async ({ page }) => {
				await page.goto(route);
				await page.waitForLoadState('networkidle');
				expect(await overflowReport(page)).toEqual([]);
			});
		}

		test.describe('signed in', () => {
			test.beforeEach(async ({ page, signIn }) => {
				await signIn(page, 'b');
			});

			for (const route of SIGNED_IN_ROUTES) {
				test(`${route} reflows`, async ({ page }) => {
					await page.goto(route);
					await page.waitForLoadState('networkidle');
					expect(await overflowReport(page)).toEqual([]);
				});
			}
		});
	});
}
