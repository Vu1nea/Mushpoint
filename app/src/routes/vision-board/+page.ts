import { listVisionItems } from '$lib/api';

export const load = async () => {
	try {
		const items = await listVisionItems();
		return { items, error: null };
	} catch (error) {
		// Shown in place, so the page and its navigation stay usable.
		return { items: [], error };
	}
};
