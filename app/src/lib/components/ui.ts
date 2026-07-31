/**
 * Shared class strings for the handful of elements that repeat everywhere.
 * Cheaper than a component per control, and keeps every screen on the same
 * tokens instead of re-deriving spacing and colors per page.
 *
 * Sizes and radii mirror `Mushtrack Static Design/Goal Tracker.dc.html`, which is
 * the reference design — when the two disagree, the mockup wins.
 */

const focusRing =
	'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

export const button = {
	/** The one loud action per screen: "New Goal", "New Task", drawer submit. */
	primary: `inline-flex items-center justify-center gap-1.5 rounded-[10px] bg-accent px-[18px] py-[11px] text-sm font-semibold text-accent-contrast transition-opacity hover:opacity-90 disabled:opacity-75 ${focusRing}`,
	ghost: `inline-flex items-center justify-center gap-1.5 rounded-lg border border-subtle bg-transparent px-3.5 py-2 text-[13px] font-semibold text-muted transition-colors hover:border-accent/60 hover:text-content disabled:opacity-50 ${focusRing}`,
	danger: `inline-flex items-center justify-center gap-1.5 rounded-lg border border-subtle bg-transparent px-3.5 py-2 text-[13px] font-semibold text-danger transition-colors hover:border-danger disabled:opacity-50 ${focusRing}`,
	/** Square, bordered, icon-only — the edit/delete pair on a detail panel. */
	icon: `inline-flex items-center justify-center rounded-lg border border-subtle p-1.5 text-muted transition-colors hover:border-accent/60 hover:text-content disabled:opacity-50 ${focusRing}`,
	/** Icon with no chrome at all: sidebar collapse, drawer close. */
	bare: `inline-flex items-center justify-center rounded-lg p-1 text-muted transition-colors hover:text-content disabled:opacity-50 ${focusRing}`
};

/** Rounded filter pill. Active reads as a filled accent tab. */
export function chip(active: boolean): string {
	return `rounded-full border px-3.5 py-[7px] text-[13px] font-semibold transition-colors ${focusRing} ${
		active
			? 'border-accent bg-accent text-accent-contrast'
			: 'border-subtle bg-transparent text-muted hover:text-content'
	}`;
}

/** Small square-ish toggle used in rows of equal-width options (timeframe, status). */
export function segment(active: boolean): string {
	return `flex-1 rounded-lg border px-2 py-2 text-[12px] font-semibold transition-colors ${focusRing} ${
		active
			? 'border-accent bg-accent text-accent-contrast'
			: 'border-subtle bg-transparent text-muted hover:text-content'
	}`;
}

export const field = {
	input: `w-full rounded-[9px] border border-subtle bg-track px-[13px] py-[11px] text-sm text-content transition-colors placeholder:text-muted/60 focus:border-accent focus:outline-none`,
	/**
	 * Inline "add another one" affordance — dashed so it reads as optional. Width
	 * is left to the caller, since these often sit side by side in a flex row.
	 */
	dashed: `rounded-[10px] border border-dashed border-subtle bg-transparent px-3.5 py-[11px] text-[13.5px] text-content transition-colors placeholder:text-muted/60 focus:border-accent focus:outline-none`,
	label: 'mb-1.5 block text-xs font-semibold text-muted'
};

/** Section titles above a group of cards. */
export const sectionHeading = 'text-[13px] font-semibold tracking-[0.06em] text-muted uppercase';

/** Hover response for anything clickable that is card-shaped. */
export const lift =
	'transition-[transform,box-shadow,border-color] duration-150 hover:-translate-y-px hover:shadow-[0_8px_14px_-6px_var(--mp-accent)]';
