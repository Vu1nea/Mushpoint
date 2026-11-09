import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import ConfirmDialog from './ConfirmDialog.svelte';

const base = {
	open: true,
	title: 'Delete your account?',
	body: 'Gone for good.',
	confirmLabel: 'Delete account',
	onConfirm: () => {},
	onCancel: () => {}
};

/** The confirm button: the last button in the dialog. */
function confirmButton(html: string) {
	const buttons = html.match(/<button[^>]*>[\s\S]*?<\/button>/g) ?? [];
	return buttons[buttons.length - 1];
}

/** Whether the button carries the `disabled` attribute (not the `disabled:` class variant). */
const isDisabled = (button: string) => /\sdisabled(?=[\s>=])/.test(button);

describe('ConfirmDialog', () => {
	it('keeps the confirm label while disabled', () => {
		const button = confirmButton(
			render(ConfirmDialog, { props: { ...base, disabled: true } }).body
		);
		expect(isDisabled(button)).toBe(true);
		expect(button).toContain('Delete account');
		expect(button).not.toContain('Deleting');
	});

	it('enables the confirm button when neither busy nor disabled', () => {
		const button = confirmButton(render(ConfirmDialog, { props: base }).body);
		expect(isDisabled(button)).toBe(false);
		expect(button).toContain('Delete account');
	});

	it('shows the busy label and disables the button while busy', () => {
		const button = confirmButton(render(ConfirmDialog, { props: { ...base, busy: true } }).body);
		expect(isDisabled(button)).toBe(true);
		expect(button).toContain('Deleting…');
	});
});
