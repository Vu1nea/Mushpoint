import { browser } from '$app/environment';
import { getSettings, setActiveTheme } from '$lib/api/settings';

export const THEMES = ['nocturne', 'coquette'] as const;
export type ThemeName = (typeof THEMES)[number];

export const THEME_LABELS: Record<ThemeName, string> = {
	nocturne: 'Nocturne',
	coquette: 'Coquette'
};

/** Swatches for the settings picker, mirroring src/lib/styles/theme.css. */
export const THEME_SWATCHES: Record<ThemeName, string[]> = {
	nocturne: ['#14152b', '#1f2147', '#7b6fc4', '#4fd1c5'],
	coquette: ['#fff8f5', '#ffffff', '#e8879f', '#9cb88a']
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
