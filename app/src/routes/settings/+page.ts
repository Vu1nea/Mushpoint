import { listCategories } from '$lib/api';

export const load = async () => {
	try {
		return { categories: await listCategories(), error: null };
	} catch (error) {
		return { categories: [], error };
	}
};
