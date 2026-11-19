/** Screens reachable without a session. Everything else needs one. */
export const PUBLIC_ROUTES = ['/login', '/signup', '/forgot-password', '/auth/callback'];

export function isPublicRoute(pathname: string): boolean {
	return PUBLIC_ROUTES.includes(pathname);
}

/**
 * The post-login destination from a `?next=` value. Only same-origin paths pass:
 * `//host` and `/\host` are protocol-relative to browsers, so they would leave the app,
 * and browsers drop tabs/newlines from URLs, so `/<tab>/host` would become `//host`.
 */
export function safeNext(raw: string | null): string {
	if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return '/';
	if (/[\u0000-\u001f]/.test(raw)) return '/';
	return raw;
}
