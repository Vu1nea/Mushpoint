import { describe, expect, it } from 'vitest';
import { loadConfig } from './config';

const base = { DATABASE_URL: 'd', SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_KEY: 'k' };

describe('loadConfig', () => {
  it('lists every missing variable at once', () => {
    expect(() => loadConfig({})).toThrow(
      'missing environment variables: DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_KEY'
    );
  });

  it('treats empty values as missing', () => {
    expect(() => loadConfig({ ...base, SUPABASE_SERVICE_KEY: '' })).toThrow(
      'missing environment variables: SUPABASE_SERVICE_KEY'
    );
  });

  it('defaults the port to 3000 and the bucket to vision', () => {
    expect(loadConfig(base)).toEqual({
      databaseUrl: 'd',
      supabaseUrl: 'https://x.supabase.co',
      supabaseServiceKey: 'k',
      port: 3000,
      imageBucket: 'vision'
    });
  });

  it('reads PORT and IMAGE_BUCKET when set', () => {
    expect(loadConfig({ ...base, PORT: '8080', IMAGE_BUCKET: 'pics' })).toMatchObject({ port: 8080, imageBucket: 'pics' });
  });

  it('strips a trailing slash from SUPABASE_URL', () => {
    expect(loadConfig({ ...base, SUPABASE_URL: 'https://x.supabase.co//' }).supabaseUrl).toBe('https://x.supabase.co');
  });

  it.each(['abc', '0', '65536', '3000.5', '30a'])('rejects PORT=%s', (port) => {
    expect(() => loadConfig({ ...base, PORT: port })).toThrow(/PORT/);
  });
});
