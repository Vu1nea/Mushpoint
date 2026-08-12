import { iconMarkup as designIconMarkup, type IconName as DesignIconName } from 'mushpoint-design/icons';

/**
 * Mushpoint-specific icons (goal/task/vision-board navigation and domain
 * concepts) that don't belong in the shared design package. Everything else
 * resolves through `mushpoint-design/icons`.
 *
 * Each entry is the inner markup of a 24x24 SVG, copied from the reference design
 * (`Mushtrack Static Design/Goal Tracker.dc.html`). Shapes use `currentColor` and
 * inherit stroke width from `Icon.svelte`, so a set only describes geometry.
 */
export type AppIconName =
	| 'dashboard'
	| 'goal'
	| 'project'
	| 'task'
	| 'idea'
	| 'vision'
	| 'settings'
	| 'flame';

export type IconName = DesignIconName | AppIconName;

const appIcons: Record<AppIconName, string> = {
	dashboard: `<rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.5"/><rect x="13" y="3.5" width="7.5" height="7.5" rx="1.5"/><rect x="3.5" y="13" width="7.5" height="7.5" rx="1.5"/><rect x="13" y="13" width="7.5" height="7.5" rx="1.5"/>`,
	goal: `<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="0.9" fill="currentColor" stroke="none"/>`,
	project: `<rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="9.5" y="4" width="5" height="10" rx="1.5"/><rect x="16" y="4" width="5" height="13" rx="1.5"/>`,
	task: `<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M8 12l2.5 2.5L16 9"/>`,
	idea: `<path d="M12 3a6 6 0 00-3.5 10.9c.6.45 1 1.15 1 1.9v.7h5v-.7c0-.75.4-1.45 1-1.9A6 6 0 0012 3z"/><path d="M10 19h4M10.5 21h3"/>`,
	vision: `<rect x="3.5" y="3.5" width="8" height="8" rx="1.5"/><rect x="12.5" y="3.5" width="8" height="5" rx="1.5"/><rect x="12.5" y="10.5" width="8" height="10" rx="1.5"/><rect x="3.5" y="13.5" width="8" height="7" rx="1.5"/>`,
	settings: `<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-1.8-.3 1.6 1.6 0 00-1 1.5V21a2 2 0 11-4 0v-.2a1.6 1.6 0 00-1-1.5 1.6 1.6 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00.3-1.8 1.6 1.6 0 00-1.5-1H3a2 2 0 110-4h.2a1.6 1.6 0 001.5-1 1.6 1.6 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 001.8.3H9a1.6 1.6 0 001-1.5V3a2 2 0 114 0v.2a1.6 1.6 0 001 1.5 1.6 1.6 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00-.3 1.8V9a1.6 1.6 0 001.5 1H21a2 2 0 110 4h-.2a1.6 1.6 0 00-1.5 1z"/>`,
	flame: `<path d="M12 2c1 4-3 5-3 9a3 3 0 006 0c1.5 1 2 3 2 4.5A5.5 5.5 0 0112 21a5.5 5.5 0 01-5.5-5.5C6.5 10 9 7 12 2z"/>`
};

function isAppIcon(name: IconName): name is AppIconName {
	return name in appIcons;
}

export function iconMarkup(name: IconName): string {
	return isAppIcon(name) ? appIcons[name] : designIconMarkup(name);
}
