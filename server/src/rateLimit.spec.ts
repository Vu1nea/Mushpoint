import { randomUUID } from 'node:crypto';
import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './app';
import { createVerifier } from './auth';
import { createMemoryAuthAdmin } from './authAdmin';
import { createPool } from './db/pool';
import { createMemoryImageStore } from './images';
import type { Limits } from './rateLimit';
import { createTestIdentity, type TestIdentity } from './testSupport/auth';
import { clientFor } from './testSupport/client';
import { purgeUsers } from './testSupport/db';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const pool = createPool(process.env.DATABASE_URL!);
const users = [randomUUID(), randomUUID(), randomUUID()];
let identity: TestIdentity;

function build(limits: Partial<Limits>): Express {
  return createApp({
    pool,
    verify: createVerifier(identity),
    images: createMemoryImageStore(),
    authAdmin: createMemoryAuthAdmin(),
    limits: { perIp: 1000, probes: 1000, uploads: 1000, accountDeletes: 1000, ...limits }
  });
}

beforeAll(async () => {
  identity = await createTestIdentity();
});

afterAll(async () => {
  await purgeUsers(users);
  await pool.end();
});

describe('rate limiting', () => {
  it('answers 429 once one address exceeds the per-IP limit', async () => {
    const app = build({ perIp: 3 });
    const c = clientFor(app, await identity.sign({ sub: users[0] }));
    for (let i = 0; i < 3; i++) await c.get('/api/categories').expect(200);
    const res = await c.get('/api/categories').expect(429);
    expect(res.body).toEqual({ kind: 'unavailable', message: 'too many requests, try again shortly' });
  });

  it('keeps the health probes out of the per-IP limit', async () => {
    const app = build({ perIp: 1 });
    for (let i = 0; i < 5; i++) await request(app).get('/api/healthz').expect(200);
    for (let i = 0; i < 5; i++) await request(app).get('/api/readyz').expect(200);
  });

  it('limits readiness checks per address, since each one queries the database', async () => {
    const app = build({ probes: 2 });
    for (let i = 0; i < 2; i++) await request(app).get('/api/readyz').expect(200);
    await request(app).get('/api/readyz').expect(429);
    await request(app).get('/api/healthz').expect(200);
  });

  it('limits image uploads per user, not per address', async () => {
    const app = build({ uploads: 2 });
    const a = clientFor(app, await identity.sign({ sub: users[0] }));
    const b = clientFor(app, await identity.sign({ sub: users[1] }));
    const send = (c: typeof a, path: string, method: 'post' | 'put') =>
      c[method](path).attach('file', PNG, { filename: 'a.png', contentType: 'image/png' });

    await a.put('/api/profile/username').send({ username: `rl_${users[0].slice(0, 8)}` }).expect(200);
    await send(a, '/api/vision-images', 'post').expect(200);
    await send(a, '/api/profile/avatar', 'put').expect(200);
    await send(a, '/api/vision-images', 'post').expect(429);
    await send(a, '/api/profile/avatar', 'put').expect(429);
    await send(b, '/api/vision-images', 'post').expect(200);
  });

  it('limits account deletion attempts per user', async () => {
    const app = build({ accountDeletes: 1 });
    const c = clientFor(app, await identity.sign({ sub: users[2] }));
    await c.delete('/api/account').expect(204);
    await c.delete('/api/account').expect(429);
  });
});
