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
		expect(opts.refresh).toHaveBeenCalledTimes(1);
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

	it('stale success skips refresh', async () => {
		const first = deferred();
		const second = deferred();
		const one = setup('task:s', () => first.promise);
		const two = setup('task:s', () => second.promise);
		const p1 = one.run();
		const p2 = two.run();
		first.resolve();
		await p1;
		expect(one.opts.refresh).not.toHaveBeenCalled();
		second.resolve();
		await p2;
	});

	it('latest failure after a stale success reverts and refreshes', async () => {
		const first = deferred();
		const second = deferred();
		const one = setup('task:f', () => first.promise);
		const two = setup('task:f', () => second.promise);
		const p1 = one.run();
		const p2 = two.run();
		first.resolve();
		await p1;
		const boom = new Error('boom');
		second.reject(boom);
		await p2;
		expect(two.opts.revert).toHaveBeenCalledTimes(1);
		expect(two.opts.onError).toHaveBeenCalledWith(boom);
		expect(two.opts.refresh).toHaveBeenCalledTimes(1);
	});

	it('settle runs after refresh, only for the latest call', async () => {
		const order: string[] = [];
		const gate = deferred();
		const opts = {
			key: 'task:g',
			apply: vi.fn(),
			revert: vi.fn(),
			call: async () => {},
			refresh: async () => {
				order.push('refresh');
				await gate.promise;
			},
			onError: vi.fn(),
			settle: () => order.push('settle')
		};
		const p1 = optimistic(opts);
		await Promise.resolve();
		await Promise.resolve();
		// A newer call starts while the first refresh is still pending.
		const second = optimistic({ ...opts, refresh: async () => {}, settle: vi.fn() });
		gate.resolve();
		await Promise.all([p1, second]);
		expect(order).toEqual(['refresh']);

		const done: string[] = [];
		await optimistic({
			...opts,
			key: 'task:h',
			refresh: async () => void done.push('refresh'),
			settle: () => done.push('settle')
		});
		expect(done).toEqual(['refresh', 'settle']);
	});

	it('failure refreshes to resync but never settles', async () => {
		const settle = vi.fn();
		const { opts } = setup('task:fail-settle', async () => {
			throw new Error('boom');
		});
		await optimistic({ ...opts, settle });
		expect(opts.refresh).toHaveBeenCalledTimes(1);
		expect(settle).not.toHaveBeenCalled();
	});

	it('refresh failure calls onError', async () => {
		const { opts, run } = setup('task:r', async () => {});
		const boom = new Error('refresh failed');
		opts.refresh.mockRejectedValueOnce(boom);
		await run();
		expect(opts.onError).toHaveBeenCalledWith(boom);
		expect(opts.revert).not.toHaveBeenCalled();
	});
});
