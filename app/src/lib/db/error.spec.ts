import { describe, expect, it } from 'vitest';
import { AppError } from './error';

describe('AppError', () => {
	it('builds a not_found error with a standard message', () => {
		const err = AppError.notFound('goal', 404);
		expect(err.kind).toBe('not_found');
		expect(err.message).toBe('goal 404 not found');
	});

	it('builds a validation error verbatim', () => {
		const err = AppError.validation('title cannot be empty');
		expect(err.kind).toBe('validation');
		expect(err.message).toBe('title cannot be empty');
	});

	it('is user-fixable only for validation and not_found', () => {
		expect(AppError.notFound('goal', 1).isUserFixable).toBe(true);
		expect(AppError.validation('bad').isUserFixable).toBe(true);
		expect(new AppError('database', 'boom').isUserFixable).toBe(false);
		expect(new AppError('internal', 'boom').isUserFixable).toBe(false);
		expect(new AppError('unavailable', 'boom').isUserFixable).toBe(false);
	});
});
