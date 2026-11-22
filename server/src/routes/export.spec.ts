import { randomUUID } from 'node:crypto';
import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { createVerifier } from '../auth';
import { createMemoryAuthAdmin } from '../authAdmin';
import { createPool } from '../db/pool';
import { createMemoryImageStore } from '../images';
import { USER_TABLES } from '../repo/account';
import { createTestIdentity } from '../testSupport/auth';
import { clientFor } from '../testSupport/client';
import { purgeUsers } from '../testSupport/db';
import { EXPORT_LINK_SECONDS } from './account';
import { TEST_PNG } from '../testSupport/png';

const pool = createPool(process.env.DATABASE_URL!);
const X = randomUUID();
const Y = randomUUID();
const Z = randomUUID();
const PNG = TEST_PNG;
const store = createMemoryImageStore();
let app: Express;
let x: ReturnType<typeof clientFor>;
let y: ReturnType<typeof clientFor>;
let z: ReturnType<typeof clientFor>;

/** Puts at least one row in every user table, and three images. */
async function seed(c: ReturnType<typeof clientFor>, name: string) {
  const upload = (method: 'post' | 'put', path: string) =>
    c[method](path).attach('file', PNG, { filename: 'a.png', contentType: 'image/png' }).expect(200);
  await c.put('/api/profile/username').send({ username: name }).expect(200);
  await upload('put', '/api/profile/avatar');
  await c.put('/api/settings/theme').send({ theme: 'coquette' }).expect(200);
  const category = (await c.post('/api/categories').send({ name: 'Health', colorToken: null }).expect(200)).body;
  const { imagePath } = (await upload('post', '/api/vision-images')).body;
  const goal = (
    await c
      .post('/api/goals')
      .send({
        categoryId: category.id,
        title: 'Run',
        description: null,
        timeframe: 'mid',
        dueDate: null,
        motivationText: null,
        motivationImagePath: imagePath,
        repoUrl: null
      })
      .expect(200)
  ).body;
  await c.post('/api/subgoals').send({ goalId: goal.id, title: '10 km', dueDate: null }).expect(200);
  const habit = (
    await c
      .post('/api/tasks')
      .send({ title: 'Stretch', dueDate: null, goalId: goal.id, subgoalId: null, recurrence: 'daily' })
      .expect(200)
  ).body;
  await c.put(`/api/tasks/${habit.id}/completion`).send({ done: true, date: null }).expect(200);
  await c.post('/api/ideas').send({ title: 'Bake', note: null, tagNames: ['cooking'] }).expect(200);
  const second = (await upload('post', '/api/vision-images')).body.imagePath;
  await c.post('/api/vision-items').send({ imagePath: second, quoteText: 'Go' }).expect(200);
}

beforeAll(async () => {
  const identity = await createTestIdentity();
  app = createApp({ pool, verify: createVerifier(identity), images: store, authAdmin: createMemoryAuthAdmin() });
  x = clientFor(app, await identity.sign({ sub: X }));
  y = clientFor(app, await identity.sign({ sub: Y }));
  z = clientFor(app, await identity.sign({ sub: Z }));
  await seed(x, `ex_${X.slice(0, 8)}`);
  await seed(y, `ex_${Y.slice(0, 8)}`);
});

afterAll(async () => {
  await purgeUsers([X, Y, Z]);
  await pool.end();
});

describe('GET /account/export', () => {
  it('has a row from every user table, all of them the caller’s', async () => {
    const body = (await x.get('/api/account/export').expect(200)).body;
    expect(body).toMatchObject({ format: 'mushpoint-export', version: 1, userId: X });
    expect(Object.keys(body.tables).sort()).toEqual([...USER_TABLES].sort());
    for (const table of USER_TABLES) {
      expect(body.tables[table].length, table).toBeGreaterThan(0);
      for (const row of body.tables[table]) expect(row.user_id, table).toBe(X);
    }
    expect(JSON.stringify(body)).not.toContain(Y);
  });

  it('links every image the account holds, valid for a day', async () => {
    const body = (await x.get('/api/account/export').expect(200)).body;
    expect(body.images).toHaveLength(3);
    for (const image of body.images) {
      expect(image.path.startsWith(`${X}/`)).toBe(true);
      expect(image.url).toBe(`memory://${image.path}?expires=${EXPORT_LINK_SECONDS}`);
    }
    const expiry = Date.parse(body.imageLinksExpireAt) - Date.parse(body.exportedAt);
    expect(expiry).toBe(EXPORT_LINK_SECONDS * 1000);
  });

  it('exports empty tables for a new account', async () => {
    const body = (await z.get('/api/account/export').expect(200)).body;
    expect(body.images).toEqual([]);
    for (const table of ['goals', 'tasks', 'ideas', 'vision_items']) expect(body.tables[table]).toEqual([]);
  });

  it('needs a token', async () => {
    await request(app).get('/api/account/export').expect(401);
  });

  it('is refused once the account is deleted', async () => {
    await y.delete('/api/account').expect(204);
    await y.get('/api/account/export').expect(401);
  });
});
