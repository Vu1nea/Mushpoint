/** Latest call number per key; only the newest call may settle the UI. */
const latest = new Map<string, number>();
let counter = 0;

export interface OptimisticOptions<T> {
	/** Identifies the thing being changed, e.g. `task:12`. */
	key: string;
	/** Shows the expected result immediately (synchronously). */
	apply: () => void;
	/** Undoes `apply` when the call fails. */
	revert: () => void;
	call: () => Promise<T>;
	/** Reloads server data (e.g. `invalidateAll`) after a successful call. */
	refresh: () => Promise<void>;
	onError: (error: unknown) => void;
}

/**
 * Applies a change to the UI first, then confirms it with the server. If a
 * newer call for the same key starts meanwhile, the older call's outcome is
 * ignored so it cannot revert or refresh over the newer intent.
 */
export async function optimistic<T>(opts: OptimisticOptions<T>): Promise<void> {
	const id = ++counter;
	latest.set(opts.key, id);
	opts.apply();
	try {
		await opts.call();
	} catch (error) {
		if (latest.get(opts.key) !== id) return;
		latest.delete(opts.key);
		opts.revert();
		opts.onError(error);
		return;
	}
	if (latest.get(opts.key) !== id) return;
	latest.delete(opts.key);
	try {
		await opts.refresh();
	} catch (error) {
		opts.onError(error);
	}
}
