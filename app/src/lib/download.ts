/** Saving the account export as a file. */

/** `mushpoint-export-2026-11-20.json`, dated in the user's local time. */
export function exportFilename(now: Date = new Date()): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	const day = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
	return `mushpoint-export-${day}.json`;
}

/** The server cannot see the sign-in email (Supabase Auth holds it), so the
 * client adds it, keeping the file a complete copy of what the user gave. */
export function withSignInEmail(
	doc: Record<string, unknown>,
	email: string | null
): Record<string, unknown> {
	return { ...doc, signInEmail: email };
}

/** Saves `data` as a pretty-printed JSON file through a temporary link. */
export function downloadJson(filename: string, data: unknown): void {
	const blob = new Blob([`${JSON.stringify(data, null, 2)}\n`], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	link.click();
	// Revoked on the next task: some browsers start the download asynchronously.
	setTimeout(() => URL.revokeObjectURL(url), 0);
}
