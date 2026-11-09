import { describe, expect, it, vi } from 'vitest';

import { optimistic } from './optimistic';

function deferred<T = void>() {
	let resolve!: (value: T) => void;
	let reject!: (reason: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

function setup(key: string, call: () => Promise<unknown>) {
	const opts = {
		key,
		apply: vi.fn(),
		revert: vi.fn(),
		call,
		refresh: vi.fn(async () => {}),
		onError: vi.fn()
	};
	return { opts, run: () => optimistic(opts) };
}

describe('optimistic', () => {
	it('applies before the call resolves', async () => {
		const d = deferred();
		const { opts, run } = setup('task:a', () => d.promise);
		const done = run();
		expect(opts.apply).toHaveBeenCalledTimes(1);
		expect(opts.refresh).not.toHaveBeenCalled();
		d.resolve();
		await done;
	});

	it('success calls refresh once and never revert', async () => {
		const { opts, run } = setup('task:b', async () => 'ok');
		await run();
		expect(opts.refresh).toHaveBeenCalledTimes(1);
		expect(opts.revert).not.toHaveBeenCalled();
		expect(opts.onError).not.toHaveBeenCalled();
	});

	it('failure reverts and reports the error', async () => {
		const boom = new Error('boom');
		const { opts, run } = setup('task:c', () => Promise.reject(boom));
		await run();
		expect(opts.revert).toHaveBeenCalledTimes(1);
		expect(opts.onError).toHaveBeenCalledWith(boom);
		expect(opts.refresh).not.toHaveBeenCalled();
	});

	it('stale failure is ignored', async () => {
		const first = deferred();
		const second = deferred();
		const one = setup('task:1', () => first.promise);
		const two = setup('task:1', () => second.promise);
		const p1 = one.run();
		const p2 = two.run();
		first.reject(new Error('old'));
		await p1;
		expect(one.opts.revert).not.toHaveBeenCalled();
		expect(one.opts.onError).not.toHaveBeenCalled();
		second.resolve();
		await p2;
		expect(two.opts.refresh).toHaveBeenCalledTimes(1);
		expect(one.opts.refresh).not.toHaveBeenCalled();
	});

	it('different keys do not affect each other', async () => {
		const first = deferred();
		const second = deferred();
		const one = setup('task:x', () => first.promise);
		const two = setup('task:y', () => second.promise);
		const p1 = one.run();
		const p2 = two.run();
		first.reject(new Error('x failed'));
		second.resolve();
		await Promise.all([p1, p2]);
		expect(one.opts.revert).toHaveBeenCalledTimes(1);
		expect(one.opts.onError).toHaveBeenCalledTimes(1);
		expect(two.opts.refresh).toHaveBeenCalledTimes(1);
		expect(two.opts.revert).not.toHaveBeenCalled();
	});
});
