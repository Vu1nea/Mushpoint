import { listCategories } from '$lib/api';
import { getSettings } from '$lib/api/settings';

export const load = async () => {
	try {
		const [categories, settings] = await Promise.all([listCategories(), getSettings()]);
		return { categories, settings, error: null };
	} catch (error) {
		return { categories: [], settings: null, error };
	}
};
