import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadConfig, resetConfigCache } from './config';

const valid = { apiUrl: 'http://api', supabaseUrl: 'http://sb', supabaseAnonKey: 'anon' };

function mockFetch(body: unknown) {
	return vi.fn(
		async () => new Response(JSON.stringify(body), { status: 200 })
	) as unknown as typeof fetch;
}

describe('loadConfig', () => {
	beforeEach(() => resetConfigCache());

	it('resolves valid config', async () => {
		await expect(loadConfig(mockFetch(valid))).resolves.toEqual(valid);
	});

	it('does not refetch on a second call', async () => {
		const f = mockFetch(valid);
		await loadConfig(f);
		await loadConfig(f);
		expect(f).toHaveBeenCalledTimes(1);
	});

	it('rejects when a field is missing', async () => {
		const { supabaseAnonKey: _omit, ...partial } = valid;
		await expect(loadConfig(mockFetch(partial))).rejects.toMatchObject({
			kind: 'internal',
			message: 'config.json is missing supabaseAnonKey'
		});
	});
});
