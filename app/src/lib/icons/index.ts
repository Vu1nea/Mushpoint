import type { ThemeName } from '$lib/theme/theme.svelte';

/**
 * Icons are referenced by logical name and resolved per theme, so a theme can
 * ship its own icon set later without touching a single component.
 *
 * Each entry is the inner markup of a 24x24 SVG, copied from the reference design
 * (`Mushtrack Static Design/Goal Tracker.dc.html`). Shapes use `currentColor` and
 * inherit stroke width from `Icon.svelte`, so a set only describes geometry.
 */
export type IconName =
	| 'dashboard'
	| 'goal'
	| 'project'
	| 'task'
	| 'idea'
	| 'vision'
	| 'settings'
	| 'plus'
	| 'minus'
	| 'check'
	| 'edit'
	| 'trash'
	| 'close'
	| 'calendar'
	| 'flame'
	| 'warning'
	| 'spinner'
	| 'sidebar'
	| 'chevron-down'
	| 'chevron-right';

type IconSet = Record<IconName, string>;

const outline: IconSet = {
	dashboard: `<rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.5"/><rect x="13" y="3.5" width="7.5" height="7.5" rx="1.5"/><rect x="3.5" y="13" width="7.5" height="7.5" rx="1.5"/><rect x="13" y="13" width="7.5" height="7.5" rx="1.5"/>`,
	goal: `<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="0.9" fill="currentColor" stroke="none"/>`,
	project: `<rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="9.5" y="4" width="5" height="10" rx="1.5"/><rect x="16" y="4" width="5" height="13" rx="1.5"/>`,
	task: `<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M8 12l2.5 2.5L16 9"/>`,
	idea: `<path d="M12 3a6 6 0 00-3.5 10.9c.6.45 1 1.15 1 1.9v.7h5v-.7c0-.75.4-1.45 1-1.9A6 6 0 0012 3z"/><path d="M10 19h4M10.5 21h3"/>`,
	vision: `<rect x="3.5" y="3.5" width="8" height="8" rx="1.5"/><rect x="12.5" y="3.5" width="8" height="5" rx="1.5"/><rect x="12.5" y="10.5" width="8" height="10" rx="1.5"/><rect x="3.5" y="13.5" width="8" height="7" rx="1.5"/>`,
	settings: `<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-1.8-.3 1.6 1.6 0 00-1 1.5V21a2 2 0 11-4 0v-.2a1.6 1.6 0 00-1-1.5 1.6 1.6 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00.3-1.8 1.6 1.6 0 00-1.5-1H3a2 2 0 110-4h.2a1.6 1.6 0 001.5-1 1.6 1.6 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 001.8.3H9a1.6 1.6 0 001-1.5V3a2 2 0 114 0v.2a1.6 1.6 0 001 1.5 1.6 1.6 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00-.3 1.8V9a1.6 1.6 0 001.5 1H21a2 2 0 110 4h-.2a1.6 1.6 0 00-1.5 1z"/>`,
	plus: `<path d="M12 5v14M5 12h14"/>`,
	minus: `<path d="M5 12h14"/>`,
	check: `<path d="M5 13l4 4L19 7"/>`,
	edit: `<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>`,
	trash: `<path d="M4 7h16M9 7V4.5a1 1 0 011-1h4a1 1 0 011 1V7m-9 0l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13"/>`,
	close: `<path d="M5 5l14 14M19 5L5 19"/>`,
	calendar: `<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M8 3v4M16 3v4M3.5 10h17"/>`,
	flame: `<path d="M12 2c1 4-3 5-3 9a3 3 0 006 0c1.5 1 2 3 2 4.5A5.5 5.5 0 0112 21a5.5 5.5 0 01-5.5-5.5C6.5 10 9 7 12 2z"/>`,
	warning: `<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>`,
	spinner: `<circle cx="12" cy="12" r="9" opacity="0.3"/><path d="M21 12a9 9 0 00-9-9"/>`,
	sidebar: `<rect x="3.5" y="4" width="17" height="16" rx="2.5"/><path d="M9.5 4v16"/>`,
	'chevron-down': `<path d="M6 9l6 6 6-6"/>`,
	'chevron-right': `<path d="M9 5l7 7-7 7"/>`
};

const ICON_SETS = { outline } satisfies Record<string, IconSet>;

/** Both shipped themes share one set for now; the indirection is the point. */
const THEME_ICON_SETS: Record<ThemeName, keyof typeof ICON_SETS> = {
	nocturne: 'outline',
	coquette: 'outline'
};

export function iconMarkup(name: IconName, themeName: ThemeName): string {
	return ICON_SETS[THEME_ICON_SETS[themeName]][name];
}
