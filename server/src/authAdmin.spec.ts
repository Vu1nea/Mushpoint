import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { createMemoryAuthAdmin, createSupabaseAuthAdmin } from './authAdmin';

describe('supabase auth admin', () => {
  const url = 'https://proj.supabase.co';
  const serviceKey = 'service-key';

  const setup = (respond: () => Promise<Response>) => {
    const fetch = vi.fn(async (..._args: Parameters<typeof globalThis.fetch>) => respond());
    const admin = createSupabaseAuthAdmin({ url, serviceKey, fetch: fetch as typeof globalThis.fetch });
    return { fetch, admin };
  };

  it('deletes the login with the service key', async () => {
    const { fetch, admin } = setup(async () => new Response('{}', { status: 200 }));
    const id = randomUUID();
    await admin.deleteUser(id);
    expect(fetch).toHaveBeenCalledTimes(1);
    const [target, init] = fetch.mock.calls[0];
    expect(String(target)).toBe(`${url}/auth/v1/admin/users/${id}`);
    expect(init!.method).toBe('DELETE');
    const headers = new Headers(init!.headers);
    expect(headers.get('apikey')).toBe(serviceKey);
    expect(headers.get('authorization')).toBe(`Bearer ${serviceKey}`);
  });

  it('treats an already-deleted login (404) as done', async () => {
    const { admin } = setup(async () => new Response('{}', { status: 404 }));
    await expect(admin.deleteUser(randomUUID())).resolves.toBeUndefined();
  });

  it('fails as unavailable on any other status or a network error', async () => {
    const failing = setup(async () => new Response('boom', { status: 500 }));
    await expect(failing.admin.deleteUser(randomUUID())).rejects.toMatchObject({
      kind: 'unavailable',
      message: 'could not delete the login'
    });
    const down = setup(async () => {
      throw new TypeError('fetch failed');
    });
    await expect(down.admin.deleteUser(randomUUID())).rejects.toMatchObject({ kind: 'unavailable' });
  });
});

describe('memory auth admin', () => {
  it('records deleted ids', async () => {
    const admin = createMemoryAuthAdmin();
    const id = randomUUID();
    await admin.deleteUser(id);
    expect(admin.deleted).toEqual([id]);
  });
});
