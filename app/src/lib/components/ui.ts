/**
 * Shared class strings for the handful of elements that repeat everywhere.
 * Cheaper than a component per control, and keeps every screen on the same
 * tokens instead of re-deriving spacing and colors per page.
 */

const focusRing =
	'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

export const button = {
	primary: `inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-contrast transition-opacity hover:opacity-90 disabled:opacity-50 ${focusRing}`,
	ghost: `inline-flex items-center gap-2 rounded-lg border border-subtle px-3 py-2 text-sm text-content transition-colors hover:bg-surface-raised disabled:opacity-50 ${focusRing}`,
	danger: `inline-flex items-center gap-2 rounded-lg px-2 py-1 text-sm text-danger transition-colors hover:bg-surface-raised disabled:opacity-50 ${focusRing}`,
	icon: `inline-flex items-center justify-center rounded-md p-1.5 text-muted transition-colors hover:bg-surface-raised hover:text-content ${focusRing}`
};

export const field = {
	input: `w-full rounded-lg border border-subtle bg-surface px-3 py-2 text-sm text-content placeholder:text-muted/70 ${focusRing}`,
	label: 'mb-1 block text-xs font-medium tracking-wide text-muted uppercase'
};

export const card = 'rounded-xl border border-subtle bg-surface p-4';
