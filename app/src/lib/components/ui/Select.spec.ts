import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import DatePicker from './DatePicker.svelte';
import Select from './Select.svelte';

describe('Select', () => {
	// Ids come from $props.id(), unique per instance within one page (each SSR
	// render here is its own page); before, every id-less Select shared one.
	it('does not fall back to a shared listbox id when none is passed', () => {
		const html = render(Select, {
			props: { value: '', options: [{ value: '', label: 'None' }] }
		}).body;
		expect(/aria-controls="([^"]+)"/.exec(html)![1]).not.toBe('select-listbox');
	});

	it('is a select-only combobox', () => {
		const html = render(Select, {
			props: { value: 'a', ariaLabel: 'Pick', options: [{ value: 'a', label: 'A' }] }
		}).body;
		expect(html).toMatch(/role="combobox"/);
		expect(html).toMatch(/aria-haspopup="listbox"/);
		expect(html).toMatch(/aria-expanded="false"/);
	});
});

describe('DatePicker', () => {
	it('describes the trigger with its current value, so a <label> name keeps the date', () => {
		const html = render(DatePicker, { props: { value: '2026-03-31', id: 'due' } }).body;
		const describedBy = /aria-describedby="([^"]+)"/.exec(html)![1];
		expect(html).toMatch(new RegExp(`<span id="${describedBy}"[^>]*>\\s*Mar 31`));
	});
});
