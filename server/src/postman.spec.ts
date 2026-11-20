import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { Express } from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './app';
import { createVerifier } from './auth';
import { createMemoryAuthAdmin } from './authAdmin';
import { createPool } from './db/pool';
import { createMemoryImageStore } from './images';
import { OPERATIONS } from './openapi';
import { buildPostman, FOLDERS, operationOf, rawBody } from './postman';
import { createTestIdentity } from './testSupport/auth';
import { clientFor } from './testSupport/client';
import { purgeUsers } from './testSupport/db';

const pool = createPool(process.env.DATABASE_URL!);
const USER = randomUUID();
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
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

describe('Postman collection', () => {
  it('matches postman.ts (run `npm run postman` after changing it)', () => {
    const committed = JSON.parse(readFileSync(new URL('../postman/mushpoint.postman_collection.json', import.meta.url), 'utf8'));
    expect(committed).toEqual(JSON.parse(JSON.stringify(buildPostman())));
  });

  it('has a step for every operation except deleting the account', () => {
    const covered = new Set(FOLDERS.flatMap((f) => f.steps.map(operationOf)));
    const missing = OPERATIONS.map((op) => `${op.method} ${op.path}`).filter((op) => !covered.has(op));
    expect(missing).toEqual(['delete /account']);
    const unknown = [...covered].filter((op) => !OPERATIONS.some((o) => `${o.method} ${o.path}` === op));
    expect(unknown).toEqual([]);
  });

  // The runner's view: every step in order, ids flowing through variables.
  it('runs top to bottom against the API', async () => {
    // `$timestamp` is a Postman dynamic variable; a unique stand-in keeps runs apart.
    const vars: Record<string, string> = { $timestamp: `${Date.now()}${Math.floor(Math.random() * 1000)}` };
    const fill = (text: string) =>
      text.replace(/\{\{(\$?\w+)\}\}/g, (_, name: string) => {
        expect(vars, `{{${name}}} is used before a step sets it`).toHaveProperty(name);
        return vars[name];
      });

    for (const folder of FOLDERS) {
      for (const step of folder.steps) {
        const qs = new URLSearchParams(step.query).toString();
        let req = client[step.method](`/api${fill(step.path)}${qs ? `?${qs}` : ''}`);
        if (step.body) req = req.send(JSON.parse(fill(rawBody(step.body))));
        if (step.upload) req = req.attach('file', PNG, { filename: 'a.png', contentType: 'image/png' });
        const res = await req;
        expect(`${folder.name} / ${step.name}: ${res.status} ${JSON.stringify(res.body)}`).toBe(
          `${folder.name} / ${step.name}: ${step.status} ${JSON.stringify(res.body)}`
        );
        if (step.capture) {
          const value = step.capture.field.split('.').reduce((obj, key) => obj?.[key], res.body);
          vars[step.capture.variable] = String(value);
        }
      }
    }
  });
});
