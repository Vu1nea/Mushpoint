import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { Express } from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './app';
import { createVerifier } from './auth';
import { createMemoryAuthAdmin } from './authAdmin';
import { createPool } from './db/pool';
import { createMemoryImageStore } from './images';
import { buildOpenApi, OPERATIONS } from './openapi';
import { createTestIdentity } from './testSupport/auth';
import { clientFor } from './testSupport/client';
import { purgeUsers } from './testSupport/db';

const pool = createPool(process.env.DATABASE_URL!);
const USER = randomUUID();
let app: Express;
let client: ReturnType<typeof clientFor>;

beforeAll(async () => {
  const identity = await createTestIdentity();
  app = createApp({ pool, verify: createVerifier(identity), images: createMemoryImageStore(), authAdmin: createMemoryAuthAdmin() });
  client = clientFor(app, await identity.sign({ sub: USER }));
});

afterAll(async () => {
  await purgeUsers([USER]);
  await pool.end();
});

describe('openapi.json', () => {
  it('matches the schemas (run `npm run openapi` after changing a route)', () => {
    const committed = JSON.parse(readFileSync(new URL('../openapi.json', import.meta.url), 'utf8'));
    expect(committed).toEqual(JSON.parse(JSON.stringify(buildOpenApi())));
  });

  // DELETE /account would delete the test user mid-run; it is covered in routes.spec.ts.
  const ops = OPERATIONS.filter((op) => !(op.method === 'delete' && op.path === '/account'));
  it.each(ops.map((op) => [op.method.toUpperCase(), op.path, op] as const))('%s %s is a mounted route', async (_m, _p, op) => {
    const res = await client[op.method](`/api${op.path.replace('{id}', '999999999')}`).send({});
    expect(res.body?.message).not.toBe('no such route');
  });
});
