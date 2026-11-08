import express from 'express';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from './app';
import { createVerifier } from './auth';
import { createPool } from './db/pool';
import { errorHandler } from './http';
import { createMemoryImageStore } from './images';
import { createTestIdentity, type TestIdentity } from './testSupport/auth';

describe('app skeleton', () => {
  const pool = createPool(process.env.DATABASE_URL!);
  let identity: TestIdentity;
  let app: express.Express;
  let token: string;

  beforeAll(async () => {
    identity = await createTestIdentity();
    token = await identity.sign();
    app = createApp({ pool, verify: createVerifier(identity), images: createMemoryImageStore() });
  });

  afterEach(() => vi.restoreAllMocks());
  afterAll(() => pool.end());

  const auth = (req: request.Test) => req.set('Authorization', `Bearer ${token}`);

  it('serves healthz without a token or a database connection', async () => {
    const connect = vi.spyOn(pool, 'connect');
    const res = await request(app).get('/api/healthz').expect(200);
    expect(res.body).toEqual({ status: 'ok' });
    expect(connect).not.toHaveBeenCalled();
  });

  it('serves readyz when the database answers', async () => {
    await request(app).get('/api/readyz').expect(200, { status: 'ready' });
  });

  it('rejects an unauthenticated data request before touching the database', async () => {
    const connect = vi.spyOn(pool, 'connect');
    const res = await request(app).get('/api/categories').expect(401);
    expect(res.body).toEqual({ kind: 'unauthenticated', message: expect.any(String) });
    expect(connect).not.toHaveBeenCalled();
  });

  it('answers 404 JSON for unknown routes', async () => {
    const res = await auth(request(app).get('/api/nope')).expect(404);
    expect(res.body).toEqual({ kind: 'not_found', message: expect.any(String) });
  });

  it('answers 400 for malformed JSON', async () => {
    await auth(request(app).post('/api/categories'))
      .set('Content-Type', 'application/json')
      .send('{oops')
      .expect(400)
      .expect((r) => expect(r.body.kind).toBe('validation'));
  });

  it('never leaks internal error text', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const boom = express()
      .get('/boom', () => {
        throw new Error('secret sql');
      })
      .use(errorHandler);
    await request(boom).get('/boom').expect(500, { kind: 'internal', message: 'internal error' });
  });

  it('maps postgres constraint errors to 400 without the database message', async () => {
    const pgErr = Object.assign(new Error('duplicate key value violates unique constraint "x"'), { code: '23505' });
    const dup = express()
      .get('/dup', () => {
        throw pgErr;
      })
      .use(errorHandler);
    await request(dup).get('/dup').expect(400, { kind: 'validation', message: 'that value already exists' });
  });
});
