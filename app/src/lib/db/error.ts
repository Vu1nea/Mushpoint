export type ErrorKind = 'not_found' | 'validation' | 'database' | 'internal' | 'unavailable';

/** Every failure the UI can observe. Thrown directly by repo code — there is
 * no process boundary left to serialize across. */
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

	static notFound(entity: string, id: number): AppError {
		return new AppError('not_found', `${entity} ${id} not found`);
	}

	static validation(message: string): AppError {
		return new AppError('validation', message);
	}
}
