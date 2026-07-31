import { invoke } from '@tauri-apps/api/core';

export type ErrorKind = 'not_found' | 'validation' | 'database' | 'internal' | 'unavailable';

/** Backend failures, normalized so the UI can branch on `kind`. */
export class AppError extends Error {
	readonly kind: ErrorKind;

	constructor(kind: ErrorKind, message: string) {
		super(message);
		this.name = 'AppError';
		this.kind = kind;
	}

	/** True when the user can fix it themselves by changing their input. */
	get isUserFixable() {
		return this.kind === 'validation' || this.kind === 'not_found';
	}

	static from(raw: unknown): AppError {
		if (raw instanceof AppError) return raw;

		if (typeof raw === 'object' && raw !== null && 'kind' in raw && 'message' in raw) {
			const { kind, message } = raw as { kind: string; message: string };
			return new AppError(kind as ErrorKind, message);
		}

		return new AppError('internal', typeof raw === 'string' ? raw : String(raw));
	}
}

function hasBackend() {
	return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/** Calls a Tauri command, turning any failure into an {@link AppError}. */
export async function call<T>(command: string, args: Record<string, unknown> = {}): Promise<T> {
	if (!hasBackend()) {
		throw new AppError(
			'unavailable',
			'The desktop backend is not running. Start the app with `npm run tauri dev` instead of `npm run dev`.'
		);
	}

	try {
		return await invoke<T>(command, args);
	} catch (raw) {
		throw AppError.from(raw);
	}
}
