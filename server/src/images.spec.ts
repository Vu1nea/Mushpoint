import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { createMemoryImageStore, createSupabaseImageStore, isOwnImagePath, sniffImageType } from './images';

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
const GIF = new TextEncoder().encode('GIF89a\x01\x00');
const WEBP = new TextEncoder().encode('RIFF\x00\x00\x00\x00WEBPVP8 ');

describe('sniffImageType', () => {
  it('recognises png, jpeg, webp and gif by their first bytes', () => {
    expect(sniffImageType(PNG)).toBe('image/png');
    expect(sniffImageType(JPEG)).toBe('image/jpeg');
    expect(sniffImageType(WEBP)).toBe('image/webp');
    expect(sniffImageType(GIF)).toBe('image/gif');
    expect(sniffImageType(new TextEncoder().encode('GIF87a..'))).toBe('image/gif');
  });

  it('returns null for text, svg and empty input', () => {
    expect(sniffImageType(new TextEncoder().encode('hello world!'))).toBeNull();
    expect(sniffImageType(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
    expect(sniffImageType(new Uint8Array())).toBeNull();
    expect(sniffImageType(new TextEncoder().encode('RIFF\x00\x00\x00\x00WAVE'))).toBeNull();
  });
});

describe('isOwnImagePath', () => {
  it('accepts only <ownUuid>/<uuid>.<ext> paths', () => {
    const me = randomUUID();
    const other = randomUUID();
    const file = randomUUID();
    expect(isOwnImagePath(me, `${me}/${file}.png`)).toBe(true);
    expect(isOwnImagePath(me, `${me}/${file}.jpg`)).toBe(true);
    expect(isOwnImagePath(me, `${other}/${file}.png`)).toBe(false);
    expect(isOwnImagePath(me, `${me}/../${other}/${file}.png`)).toBe(false);
    expect(isOwnImagePath(me, `${me}/${file}.svg`)).toBe(false);
    expect(isOwnImagePath(me, `${me}/${file}.png/extra`)).toBe(false);
  });

  it('rejects a non-uuid user id instead of building a regex from it', () => {
    expect(isOwnImagePath('.*', `x/${randomUUID()}.png`)).toBe(false);
  });
});

describe('memory store', () => {
  it('round-trips put, signedUrls and remove', async () => {
    const store = createMemoryImageStore();
    const me = randomUUID();
    const path = await store.put(me, PNG, 'image/png');
    expect(isOwnImagePath(me, path)).toBe(true);
    expect(store.objects.get(path)).toEqual(PNG);
    const [url, missing] = await store.signedUrls([path, `${me}/${randomUUID()}.png`], 60);
    expect(url).toEqual(expect.any(String));
    expect(missing).toBeNull();
    await store.remove(path);
    await store.remove(path); // missing is a no-op
    expect(store.objects.has(path)).toBe(false);
  });
});

describe('supabase store', () => {
  const url = 'https://proj.supabase.co';
  const serviceKey = 'service-key';
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  const setup = (response: Response) => {
    const fetch = vi.fn(async (..._args: Parameters<typeof globalThis.fetch>) => response);
    const store = createSupabaseImageStore({ url, serviceKey, bucket: 'vision', fetch: fetch as typeof globalThis.fetch });
    const call = () => {
      const [target, init] = fetch.mock.calls[0];
      return { target: String(target), init: init!, headers: new Headers(init!.headers) };
    };
    return { fetch, store, call };
  };

  it('uploads with the sniffed content type and no upsert', async () => {
    const { store, call } = setup(json({ Key: 'vision/x' }));
    const me = randomUUID();
    const path = await store.put(me, PNG, 'image/png');
    expect(isOwnImagePath(me, path)).toBe(true);
    const { target, init, headers } = call();
    expect(target).toBe(`${url}/storage/v1/object/vision/${path}`);
    expect(init.method).toBe('POST');
    expect(headers.get('authorization')).toBe(`Bearer ${serviceKey}`);
    expect(headers.get('apikey')).toBe(serviceKey);
    expect(headers.get('content-type')).toBe('image/png');
    expect(headers.get('x-upsert')).toBe('false');
    expect(init.body).toEqual(PNG);
  });

  it('fails an upload as unavailable on a non-2xx answer', async () => {
    const { store } = setup(json({ error: 'nope' }, 500));
    await expect(store.put(randomUUID(), PNG, 'image/png')).rejects.toMatchObject({ kind: 'unavailable' });
  });

  it('signs paths in one call and keeps their order', async () => {
    const { store, call } = setup(
      json([
        { path: 'a', signedURL: '/object/sign/vision/a.png?token=t1', error: null },
        { path: 'b', signedURL: null, error: 'Either the object does not exist or you do not have access to it' }
      ])
    );
    expect(await store.signedUrls(['a', 'b'], 3600)).toEqual([
      `${url}/storage/v1/object/sign/vision/a.png?token=t1`,
      null
    ]);
    const { target, init, headers } = call();
    expect(target).toBe(`${url}/storage/v1/object/sign/vision`);
    expect(init.method).toBe('POST');
    expect(headers.get('authorization')).toBe(`Bearer ${serviceKey}`);
    expect(headers.get('content-type')).toBe('application/json');
    expect(JSON.parse(String(init.body))).toEqual({ expiresIn: 3600, paths: ['a', 'b'] });
  });

  it('signs nothing without a request', async () => {
    const { store, fetch } = setup(json([]));
    expect(await store.signedUrls([], 3600)).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('removes by prefix', async () => {
    const { store, call } = setup(json([]));
    await store.remove('u/x.png');
    const { target, init, headers } = call();
    expect(target).toBe(`${url}/storage/v1/object/vision`);
    expect(init.method).toBe('DELETE');
    expect(headers.get('apikey')).toBe(serviceKey);
    expect(JSON.parse(String(init.body))).toEqual({ prefixes: ['u/x.png'] });
  });
});
