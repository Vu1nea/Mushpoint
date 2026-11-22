import { Writable } from 'node:stream';
import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './app';
import { createVerifier } from './auth';
import { createMemoryAuthAdmin } from './authAdmin';
import { createPool } from './db/pool';
import { createMemoryImageStore } from './images';
import { createLogger } from './logger';
import { createTestIdentity } from './testSupport/auth';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const pool = createPool(process.env.DATABASE_URL!);
let lines: Record<string, unknown>[] = [];
let app: Express;
let token: string;

beforeAll(async () => {
  const identity = await createTestIdentity();
  token = await identity.sign();
  const sink = new Writable({
    write(chunk, _enc, done) {
      lines.push(JSON.parse(chunk.toString()));
      done();
    }
  });
  app = createApp({
    pool,
    verify: createVerifier(identity),
    images: createMemoryImageStore(),
    authAdmin: createMemoryAuthAdmin(),
    logger: createLogger({ level: 'info' }, sink)
  });
});

beforeEach(() => {
  lines = [];
});

afterAll(() => pool.end());

const requestLines = () => lines.filter((l) => l.msg === 'request');

describe('request logging', () => {
  it('gives every response a request id', async () => {
    const res = await request(app).get('/api/healthz').expect(200);
    expect(res.headers['x-request-id']).toMatch(UUID);
  });

  it('keeps a safe inbound request id so traces join up across the proxy', async () => {
    const res = await request(app).get('/api/healthz').set('X-Request-Id', 'ingress-abc_123').expect(200);
    expect(res.headers['x-request-id']).toBe('ingress-abc_123');
  });

  it.each([['has spaces'], ['x'.repeat(129)], ['bad/char']])('replaces an unsafe inbound id %#', async (bad) => {
    const res = await request(app).get('/api/healthz').set('X-Request-Id', bad).expect(200);
    expect(res.headers['x-request-id']).toMatch(UUID);
  });

  it('logs one line per request with method, path, status, duration and id', async () => {
    // Unknown routes sit behind authentication, so an anonymous call is a 401.
    const res = await request(app).get('/api/no-such-route?secret=1').expect(401);
    const [line] = requestLines();
    expect(requestLines()).toHaveLength(1);
    expect(line).toMatchObject({
      level: 30,
      requestId: res.headers['x-request-id'],
      method: 'GET',
      path: '/api/no-such-route',
      status: 401
    });
    expect(typeof line.durationMs).toBe('number');
  });

  it('never writes the bearer token or the query string', async () => {
    await request(app).get('/api/categories?q=private').set('Authorization', `Bearer ${token}`).set('X-Timezone', 'UTC');
    const text = JSON.stringify(lines);
    expect(text).not.toContain(token);
    expect(text).not.toContain('private');
    expect(requestLines()[0]).toMatchObject({ status: 200 });
  });

  it('logs client errors at info level with the request id', async () => {
    const res = await request(app).get('/api/categories').set('Authorization', 'Bearer not-a-jwt').expect(401);
    expect(requestLines()[0]).toMatchObject({ status: 401, level: 30, requestId: res.headers['x-request-id'] });
  });
});
