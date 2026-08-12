/**
 * Each entry is the inner markup of a 24x24 SVG. Shapes use `currentColor` and
 * inherit stroke width from the consuming `Icon.svelte`, so a set only
 * describes geometry.
 */
export type IconName =
	| 'plus'
	| 'minus'
	| 'check'
	| 'edit'
	| 'trash'
	| 'close'
	| 'calendar'
	| 'warning'
	| 'spinner'
	| 'sidebar'
	| 'chevron-down'
	| 'chevron-right'
	| 'github';

const icons: Record<IconName, string> = {
	plus: `<path d="M12 5v14M5 12h14"/>`,
	minus: `<path d="M5 12h14"/>`,
	check: `<path d="M5 13l4 4L19 7"/>`,
	edit: `<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>`,
	trash: `<path d="M4 7h16M9 7V4.5a1 1 0 011-1h4a1 1 0 011 1V7m-9 0l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13"/>`,
	close: `<path d="M5 5l14 14M19 5L5 19"/>`,
	calendar: `<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M8 3v4M16 3v4M3.5 10h17"/>`,
	warning: `<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>`,
	spinner: `<circle cx="12" cy="12" r="9" opacity="0.3"/><path d="M21 12a9 9 0 00-9-9"/>`,
	sidebar: `<rect x="3.5" y="4" width="17" height="16" rx="2.5"/><path d="M9.5 4v16"/>`,
	'chevron-down': `<path d="M6 9l6 6 6-6"/>`,
	'chevron-right': `<path d="M9 5l7 7-7 7"/>`,
	github: `<g fill="currentColor" stroke="none" transform="scale(1.5)"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></g>`
};

export function iconMarkup(name: IconName): string {
	return icons[name];
}
