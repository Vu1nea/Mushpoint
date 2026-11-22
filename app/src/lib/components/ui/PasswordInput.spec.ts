import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import PasswordInput from './PasswordInput.svelte';

describe('PasswordInput', () => {
	const html = render(PasswordInput, {
		props: { value: 'secret', name: 'password', autocomplete: 'current-password', required: true }
	}).body;

	it('starts hidden and passes input attributes through', () => {
		const input = html.match(/<input[^>]*>/)?.[0] ?? '';
		expect(input).toContain('type="password"');
		expect(input).toContain('name="password"');
		expect(input).toContain('autocomplete="current-password"');
		expect(input).toMatch(/\srequired/);
	});

	it('offers a non-submitting show-password toggle', () => {
		const button = html.match(/<button[^>]*>/)?.[0] ?? '';
		expect(button).toContain('type="button"');
		expect(button).toContain('aria-label="Show password"');
		expect(button).toContain('aria-pressed="false"');
	});
});
