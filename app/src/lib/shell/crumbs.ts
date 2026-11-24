export type Crumb = { label: string; href?: string };

const SECTIONS: Record<string, string> = {
	'/goals': 'Goals',
	'/tasks': 'Tasks',
	'/ideas': 'Ideas',
	'/vision-board': 'Vision Board',
	'/settings': 'Settings'
};

export function crumbsFor(pathname: string): Crumb[] {
	const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
	if (path === '/') return [{ label: 'Dashboard' }];
	if (SECTIONS[path]) return [{ label: SECTIONS[path] }];
	if (/^\/goals\/[^/]+$/.test(path)) return [{ label: 'Goals', href: '/goals' }, { label: 'Goal' }];
	return [{ label: 'Mushpoint' }];
}
