import { browser } from '$app/environment';
import { getSettings, setActiveTheme } from '$lib/api/settings';

export const THEMES = ['nocturne', 'coquette'] as const;
export type ThemeName = (typeof THEMES)[number];

export const THEME_LABELS: Record<ThemeName, string> = {
	nocturne: 'Nocturne',
	coquette: 'Coquette'
};

interface ThemePreview {
	bg: string;
	surface: string;
	text: string;
	accents: string[];
}

/**
 * Miniature of each palette for the settings picker. These are literal hex values
 * on purpose: a preview has to paint the *other* theme's colors while the current
 * one is active, so it cannot read the theme variables. Mirrors theme.css.
 */
export const THEME_PREVIEWS: Record<ThemeName, ThemePreview> = {
	nocturne: {
		bg: '#14152b',
		surface: '#1f2147',
		text: '#f2f1fb',
		accents: ['#7b6fc4', '#4fd1c5', '#5ba8d4']
	},
	coquette: {
		bg: '#fff8f5',
		surface: '#ffffff',
		text: '#4a2e33',
		accents: ['#e8879f', '#9cb88a', '#c9a8d4']
	}
};

const STORAGE_KEY = 'mushpoint:theme';
const DEFAULT_THEME: ThemeName = 'nocturne';

function isTheme(value: unknown): value is ThemeName {
	return typeof value === 'string' && (THEMES as readonly string[]).includes(value);
}

/**
 * The active theme. SQLite is the source of truth, but the choice is mirrored to
 * localStorage so the first paint after launch already uses the right palette
 * instead of flashing the default.
 */
class ThemeStore {
	current = $state<ThemeName>(DEFAULT_THEME);

	/** Applies the last known theme immediately, then reconciles with the database. */
	async init() {
		if (!browser) return;

		const cached = localStorage.getItem(STORAGE_KEY);
		if (isTheme(cached)) this.#apply(cached);

		const stored = (await getSettings()).activeTheme;
		if (isTheme(stored)) this.#apply(stored);
	}

	async set(name: ThemeName) {
		const previous = this.current;
		this.#apply(name);
		try {
			await setActiveTheme(name);
		} catch (error) {
			this.#apply(previous);
			throw error;
		}
	}

	#apply(name: ThemeName) {
		this.current = name;
		if (!browser) return;
		document.documentElement.dataset.theme = name;
		localStorage.setItem(STORAGE_KEY, name);
	}
}

export const theme = new ThemeStore();
