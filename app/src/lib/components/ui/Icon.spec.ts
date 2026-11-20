import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Icon from './Icon.svelte';

describe('Icon', () => {
	it('names an icon-only button: the label reaches the button with no role in between', () => {
		// An icon with a label sits inside icon-only <button>s. Any role on a
		// wrapper between them (the tooltip once used role="group") drops the
		// label from the button's accessible name in Chromium.
		const html = render(Icon, { props: { name: 'plus', label: 'Increase grace period' } }).body;
		expect(html).toMatch(/<svg[^>]*role="img"[^>]*aria-label="Increase grace period"/);
		expect(html.slice(0, html.indexOf('<svg'))).not.toMatch(/\srole="/);
	});

	it('hides a decorative icon from assistive tech', () => {
		const html = render(Icon, { props: { name: 'plus' } }).body;
		expect(html).toContain('aria-hidden="true"');
		expect(html).not.toContain('aria-label');
	});
});
