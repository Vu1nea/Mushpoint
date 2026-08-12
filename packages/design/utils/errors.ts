/**
 * Normalizes an unknown thrown value into a display-ready `{ kind, message }`
 * shape for Drawer/ErrorBanner. Duck-types rather than importing a consumer's
 * error class, so it reads a Mushpoint `AppError` (or any similarly-shaped
 * error) without this package depending on that class.
 */
export interface DisplayError {
	kind: string;
	message: string;
}

export function normalizeError(raw: unknown): DisplayError {
	if (typeof raw === 'object' && raw !== null && 'kind' in raw && 'message' in raw) {
		const { kind, message } = raw as { kind: unknown; message: unknown };
		return { kind: String(kind), message: String(message) };
	}
	return { kind: 'internal', message: typeof raw === 'string' ? raw : String(raw) };
}
