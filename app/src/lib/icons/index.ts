import type { ThemeName } from '$lib/theme/theme.svelte';

/**
 * Icons are referenced by logical name and resolved per theme, so a theme can
 * ship its own icon set later without touching a single component.
 * Every path is drawn on a 24x24 grid and rendered stroked, never filled.
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
	| 'check'
	| 'edit'
	| 'trash'
	| 'close'
	| 'calendar'
	| 'flame'
	| 'chevron-right';

type IconSet = Record<IconName, string>;

const outline: IconSet = {
	dashboard: 'M4 4h7v7H4zM13 4h7v4h-7zM13 11h7v9h-7zM4 14h7v6H4z',
	goal: 'M12 21a9 9 0 110-18 9 9 0 010 18zM12 17a5 5 0 110-10 5 5 0 010 10zM12 13.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3z',
	project: 'M4 4h5v12H4zM10 4h5v8h-5zM16 4h4v16h-4z',
	task: 'M4 5h16v14H4zM8 12l3 3 5-6',
	idea: 'M9 18h6M10 21h4M12 3a6 6 0 00-3 11v2h6v-2a6 6 0 00-3-11z',
	vision: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
	settings: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4',
	plus: 'M12 5v14M5 12h14',
	check: 'M5 13l4 4L19 7',
	edit: 'M4 20h4L19 9a2.5 2.5 0 10-3.5-3.5L4 16v4z',
	trash: 'M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13',
	close: 'M6 6l12 12M18 6L6 18',
	calendar: 'M4 6h16v14H4zM8 3v4M16 3v4M4 10h16',
	flame: 'M12 3c3 4 6 5 6 9a6 6 0 11-12 0c0-2 1-3 2-4 0 2 1 3 2 3 1-3-1-5 2-8z',
	'chevron-right': 'M9 6l6 6-6 6'
};

const ICON_SETS = { outline } satisfies Record<string, IconSet>;

/** Both shipped themes share one set for now; the indirection is the point. */
const THEME_ICON_SETS: Record<ThemeName, keyof typeof ICON_SETS> = {
	nocturne: 'outline',
	coquette: 'outline'
};

export function iconPath(name: IconName, themeName: ThemeName): string {
	return ICON_SETS[THEME_ICON_SETS[themeName]][name];
}
