import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { createSupabaseAuthAdmin } from './authAdmin';
import { createSupabaseImageStore } from './images';
import { serviceKeyHeaders } from './supabaseKey';

const LEGACY = 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.sig';
const SECRET = 'sb_secret_abc123';

describe('serviceKeyHeaders', () => {
  it('sends a legacy JWT key as both apikey and bearer token', () => {
    expect(serviceKeyHeaders(LEGACY)).toEqual({ apikey: LEGACY, Authorization: `Bearer ${LEGACY}` });
  });

  it('sends a new sb_secret_ key as apikey only, since it is not a JWT', () => {
    expect(serviceKeyHeaders(SECRET)).toEqual({ apikey: SECRET });
  });
});

describe('Supabase clients with a new secret key', () => {
  const url = 'https://proj.supabase.co';
  const fetchOk = () =>
    vi.fn(async (..._args: Parameters<typeof globalThis.fetch>) => new Response('{}', { status: 200 }));

  it('auth admin sends no bearer token', async () => {
    const fetch = fetchOk();
    await createSupabaseAuthAdmin({ url, serviceKey: SECRET, fetch: fetch as typeof globalThis.fetch }).deleteUser(
      randomUUID()
    );
    const headers = new Headers(fetch.mock.calls[0][1]!.headers);
    expect(headers.get('apikey')).toBe(SECRET);
    expect(headers.get('authorization')).toBeNull();
  });

  it('image store sends no bearer token', async () => {
    const fetch = fetchOk();
    const store = createSupabaseImageStore({ url, serviceKey: SECRET, bucket: 'vision', fetch: fetch as typeof globalThis.fetch });
    await store.remove(`${randomUUID()}/x.png`).catch(() => undefined);
    const headers = new Headers(fetch.mock.calls[0][1]!.headers);
    expect(headers.get('apikey')).toBe(SECRET);
    expect(headers.get('authorization')).toBeNull();
  });
});
