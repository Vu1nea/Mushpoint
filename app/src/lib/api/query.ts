/** Appends the defined params as a query string; null/undefined are left out. */
export function withQuery(
	path: string,
	params: Record<string, string | number | boolean | null | undefined>
) {
	const query = new URLSearchParams();
	for (const [key, value] of Object.entries(params)) {
		if (value !== null && value !== undefined) query.set(key, String(value));
	}
	const text = query.toString();
	return text ? `${path}?${text}` : path;
}
