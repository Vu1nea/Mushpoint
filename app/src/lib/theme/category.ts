import type { Category } from '$lib/api';

/**
 * Categories store a semantic token name, never a hex value, so their color
 * follows whichever theme is active. Anything unrecognised (or unset) falls back
 * to the primary accent.
 */
const TOKEN_VARIABLES: Record<string, string> = {
	'accent-primary': 'var(--mp-accent)',
	'accent-secondary': 'var(--mp-accent-secondary)',
	'accent-tertiary': 'var(--mp-accent-tertiary)'
};

/** The tokens a user can pick for a category, in display order. */
export const CATEGORY_COLOR_TOKENS = [
	{ token: 'accent-primary', label: 'Primary accent' },
	{ token: 'accent-secondary', label: 'Secondary accent' },
	{ token: 'accent-tertiary', label: 'Tertiary accent' }
] as const;

export function categoryColor(colorToken: string | null | undefined): string {
	return (colorToken && TOKEN_VARIABLES[colorToken]) || 'var(--mp-accent)';
}

export function colorForCategoryId(
	categories: Category[],
	categoryId: number | null | undefined
): string {
	return categoryColor(categories.find((category) => category.id === categoryId)?.colorToken);
}
