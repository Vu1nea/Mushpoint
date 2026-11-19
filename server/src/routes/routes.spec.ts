/* eslint-disable @typescript-eslint/no-explicit-any */
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

const goalBody = {
  categoryId: null,
  title: 'G',
  description: null,
  timeframe: 'mid',
  dueDate: null,
  motivationText: null,
  motivationImagePath: null,
  repoUrl: null
};
const taskBody = { title: 'T', dueDate: null, goalId: null, subgoalId: null, recurrence: null };

const pool = createPool(process.env.DATABASE_URL!);
const A = randomUUID();
const B = randomUUID();
const C = randomUUID();
const D = randomUUID();
const E = randomUUID();
const store = createMemoryImageStore();
const authAdmin = createMemoryAuthAdmin();
let app: Express;
let a:ReturnType<typeof clientFor>;
let b: ReturnType<typeof clientFor>;
let tokenA: string;
let c: ReturnType<typeof clientFor>;
let d: ReturnType<typeof clientFor>;
let identity: Awaited<ReturnType<typeof createTestIdentity>>;

beforeAll(async () => {
  identity = await createTestIdentity();
  app = createApp({ pool, verify: createVerifier(identity), images: store, authAdmin });
  tokenA = await identity.sign({ sub: A });
  a = clientFor(app, tokenA);
  b = clientFor(app, await identity.sign({ sub: B }));
  c = clientFor(app, await identity.sign({ sub: C }));
  d = clientFor(app, await identity.sign({ sub: D }));
});

afterAll(async () => {
  await purgeUsers([A, B, C, D, E]);
  await pool.end();
});

const ids = (body: any[]) => body.map((x) => x.id);

const groups = [
  { name: 'categories', path: '/api/categories', create: { name: 'Hobbies', colorToken: null }, update: { name: 'Crafts', colorToken: null } },
  { name: 'ideas', path: '/api/ideas', create: { title: 'Idea', note: null, tagNames: ['x'] }, update: { title: 'Idea 2', note: 'n', tagNames: [] } },
  { name: 'vision-items', path: '/api/vision-items', create: { imagePath: null, quoteText: 'Go' }, update: { imagePath: null, quoteText: 'Go on' } },
  { name: 'goals', path: '/api/goals', create: goalBody, update: { ...goalBody, title: 'Renamed' } },
  { name: 'tasks', path: '/api/tasks', create: taskBody, update: { ...taskBody, status: 'in_progress' } }
];

describe.each(groups)('$name', (g) => {
  it('supports create, read, update and delete for its owner', async () => {
    const created = (await a.post(g.path).send(g.create).expect(200)).body;
    expect(ids((await a.get(g.path).expect(200)).body)).toContain(created.id);
    const updated = (await a.put(`${g.path}/${created.id}`).send(g.update).expect(200)).body;
    expect(updated.id).toBe(created.id);
    await a.delete(`${g.path}/${created.id}`).expect(204);
    expect(ids((await a.get(g.path).expect(200)).body)).not.toContain(created.id);
  });

  it("hides the owner's records from other users", async () => {
    const created = (await a.post(g.path).send(g.create).expect(200)).body;
    expect(ids((await b.get(g.path).expect(200)).body)).not.toContain(created.id);
    await b.put(`${g.path}/${created.id}`).send(g.update).expect(404);
    await b.delete(`${g.path}/${created.id}`).expect(404);
  });
});

const newGoal = async (title = 'G') => (await a.post('/api/goals').send({ ...goalBody, title }).expect(200)).body;

describe('subgoals', () => {
  it('creates under the owner goal, rejects other users and toggles completion', async () => {
    const goal = await newGoal();
    const sub = (await a.post('/api/subgoals').send({ goalId: goal.id, title: 'S', dueDate: null }).expect(200)).body;
    expect(sub.goalId).toBe(goal.id);
    expect(ids((await a.get('/api/subgoals').expect(200)).body)).toContain(sub.id);
    await b.post('/api/subgoals').send({ goalId: goal.id, title: 'S', dueDate: null }).expect(404);
    const done = (await a.put(`/api/subgoals/${sub.id}/complete`).send({ isComplete: true }).expect(200)).body;
    expect(done.isComplete).toBe(true);
    const renamed = (await a.put(`/api/subgoals/${sub.id}`).send({ title: 'S2', dueDate: null, isComplete: false }).expect(200)).body;
    expect(renamed.title).toBe('S2');
    await b.delete(`/api/subgoals/${sub.id}`).expect(404);
    await a.delete(`/api/subgoals/${sub.id}`).expect(204);
  });
});

describe('goals', () => {
  it('hides a goal detail from other users', async () => {
    const goal = await newGoal();
    expect((await a.get(`/api/goals/${goal.id}`).expect(200)).body.id).toBe(goal.id);
    await b.get(`/api/goals/${goal.id}`).expect(404);
  });

  it('changes status and filters the list by it', async () => {
    const goal = await newGoal();
    const archived = (await a.put(`/api/goals/${goal.id}/status`).send({ status: 'archived' }).expect(200)).body;
    expect(archived.status).toBe('archived');
    expect(ids((await a.get('/api/goals?status=archived').expect(200)).body)).toContain(goal.id);
    expect(ids((await a.get('/api/goals?status=active').expect(200)).body)).not.toContain(goal.id);
    await a.get('/api/goals?status=bogus').expect(400);
  });

  it.each([
    [true, false],
    [false, true]
  ])('deleteOrphanedTasks=%s keeps subgoal tasks: %s', async (flag, kept) => {
    const goal = await newGoal();
    const sub = (await a.post('/api/subgoals').send({ goalId: goal.id, title: 'S', dueDate: null }).expect(200)).body;
    const task = (await a.post('/api/tasks').send({ ...taskBody, subgoalId: sub.id }).expect(200)).body;
    await a.delete(`/api/goals/${goal.id}?deleteOrphanedTasks=${flag}`).expect(204);
    const tasks = (await a.get('/api/tasks').expect(200)).body;
    expect(ids(tasks).includes(task.id)).toBe(kept);
  });

  it('treats a missing deleteOrphanedTasks as false', async () => {
    const goal = await newGoal();
    const sub = (await a.post('/api/subgoals').send({ goalId: goal.id, title: 'S', dueDate: null }).expect(200)).body;
    const task = (await a.post('/api/tasks').send({ ...taskBody, subgoalId: sub.id }).expect(200)).body;
    await a.delete(`/api/goals/${goal.id}`).expect(204);
    expect(ids((await a.get('/api/tasks').expect(200)).body)).toContain(task.id);
  });
});

describe('tasks', () => {
  it('changes status', async () => {
    const task = (await a.post('/api/tasks').send(taskBody).expect(200)).body;
    expect((await a.put(`/api/tasks/${task.id}/status`).send({ status: 'done' }).expect(200)).body.status).toBe('done');
    await b.put(`/api/tasks/${task.id}/status`).send({ status: 'done' }).expect(404);
  });

  it("rejects another user's goal as parent", async () => {
    const goal = await newGoal();
    await b.post('/api/tasks').send({ ...taskBody, goalId: goal.id }).expect(404);
  });

  it('requires X-Timezone to list', async () => {
    await request(app).get('/api/tasks').set('Authorization', `Bearer ${tokenA}`).expect(400);
  });
});

describe('streaks', () => {
  it('marks a habit done today', async () => {
    const habit = (await a.post('/api/tasks').send({ ...taskBody, title: 'Habit', recurrence: 'daily' }).expect(200)).body;
    const card = (await a.put(`/api/tasks/${habit.id}/completion`).send({ done: true }).expect(200)).body;
    expect(card.doneToday).toBe(true);
    const cards = (await a.get('/api/streaks?days=7').expect(200)).body;
    const mine = cards.find((c: any) => c.task.id === habit.id);
    expect(mine.doneToday).toBe(true);
    expect(mine.cells).toHaveLength(7);
    await b.put(`/api/tasks/${habit.id}/completion`).send({ done: true }).expect(404);
  });

  it.each(['0', '367', 'abc', '1.5'])('rejects days=%s', async (days) => {
    await a.get(`/api/streaks?days=${days}`).expect(400);
  });

  it('requires X-Timezone', async () => {
    await request(app).get('/api/streaks').set('Authorization', `Bearer ${tokenA}`).expect(400);
  });
});

describe('ideas', () => {
  it('promotes into a new owner goal once and lists tags', async () => {
    const idea = (await a.post('/api/ideas').send({ title: 'I', note: null, tagNames: ['Spark'] }).expect(200)).body;
    expect((await a.get(`/api/ideas/${idea.id}`).expect(200)).body.id).toBe(idea.id);
    await b.get(`/api/ideas/${idea.id}`).expect(404);
    expect((await a.get('/api/idea-tags').expect(200)).body.map((t: any) => t.name)).toContain('Spark');
    expect((await b.get('/api/idea-tags').expect(200)).body).toEqual([]);
    const bGoalsBefore = ids((await b.get('/api/goals').expect(200)).body);
    await b.post(`/api/ideas/${idea.id}/promote`).send({ ...goalBody, title: 'Stolen' }).expect(404);
    expect(ids((await b.get('/api/goals').expect(200)).body)).toEqual(bGoalsBefore); // rolled back
    const promoted = (await a.post(`/api/ideas/${idea.id}/promote`).send({ ...goalBody, title: 'From I' }).expect(200)).body;
    expect(promoted.goal.title).toBe('From I');
    expect(promoted.idea.promotedGoalId).toBe(promoted.goal.id);
    expect((await a.get(`/api/goals/${promoted.goal.id}`).expect(200)).body.fromIdea).toBe(true);
    await a.post(`/api/ideas/${idea.id}/promote`).send({ ...goalBody, title: 'Again' }).expect(400);
    expect(ids((await a.get('/api/ideas').expect(200)).body)).not.toContain(idea.id);
    expect(ids((await a.get('/api/ideas?includePromoted=true').expect(200)).body)).toContain(idea.id);
  });

  it('a rejected goal body promotes nothing', async () => {
    const idea = (await a.post('/api/ideas').send({ title: 'Keep', note: null, tagNames: [] }).expect(200)).body;
    await a.post(`/api/ideas/${idea.id}/promote`).send({ ...goalBody, title: '  ' }).expect(400);
    expect(ids((await a.get('/api/ideas').expect(200)).body)).toContain(idea.id);
  });

  it('filters by tag', async () => {
    const tagged = (await a.post('/api/ideas').send({ title: 'T', note: null, tagNames: ['only-here'] }).expect(200)).body;
    const other = (await a.post('/api/ideas').send({ title: 'O', note: null, tagNames: [] }).expect(200)).body;
    const listed = ids((await a.get('/api/ideas?tag=only-here').expect(200)).body);
    expect(listed).toContain(tagged.id);
    expect(listed).not.toContain(other.id);
  });
});

describe('vision-items', () => {
  it('reorders only the owner items', async () => {
    const first = (await a.post('/api/vision-items').send({ imagePath: null, quoteText: '1' }).expect(200)).body;
    const second = (await a.post('/api/vision-items').send({ imagePath: null, quoteText: '2' }).expect(200)).body;
    const bItem = (await b.post('/api/vision-items').send({ imagePath: null, quoteText: 'b' }).expect(200)).body;
    const bBefore = (await b.get('/api/vision-items').expect(200)).body;

    await a.put('/api/vision-items/order').send({ orderedIds: [second.id, first.id, bItem.id] }).expect(204);

    const mine = ids((await a.get('/api/vision-items').expect(200)).body);
    expect(mine.indexOf(second.id)).toBeLessThan(mine.indexOf(first.id));
    expect((await b.get('/api/vision-items').expect(200)).body).toEqual(bBefore);
  });

  it('rejects a non-array orderedIds', async () => {
    await a.put('/api/vision-items/order').send({ orderedIds: 'nope' }).expect(400);
  });
});

describe('vision images', () => {
  const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  const upload = async () =>
    (await a.post('/api/vision-images').attach('file', Buffer.from(PNG), { filename: 'a.png', contentType: 'image/png' }).expect(200)).body;

  it('uploads an image and returns a path and a signed url', async () => {
    const body = await upload();
    expect(body.imagePath).toMatch(new RegExp(`^${A}/[0-9a-f-]{36}\\.png$`));
    expect(body.imageUrl).toEqual(expect.any(String));
    expect(store.objects.has(body.imagePath)).toBe(true);
  });

  it('requires a token to upload', async () => {
    await request(app).post('/api/vision-images').attach('file', Buffer.from(PNG), { filename: 'a.png', contentType: 'image/png' }).expect(401);
  });

  it.each([
    ['wrong declared type', Buffer.from(PNG), 'a.txt', 'text/plain'],
    ['declared png but not an image', Buffer.from('hello world!'), 'a.png', 'image/png'],
    ['svg', Buffer.from('<svg/>'), 'a.svg', 'image/svg+xml']
  ])('rejects %s', async (_name, buf, filename, contentType) => {
    const res = await a.post('/api/vision-images').attach('file', buf, { filename, contentType }).expect(400);
    expect(res.body.kind).toBe('validation');
  });

  it('rejects an empty upload and a request with no file', async () => {
    await a.post('/api/vision-images').attach('file', Buffer.alloc(0), { filename: 'a.png', contentType: 'image/png' }).expect(400);
    await a.post('/api/vision-images').field('other', 'x').expect(400);
    await a.post('/api/vision-images').send({}).expect(400);
  });

  it('rejects files over 5 MB', async () => {
    const res = await a
      .post('/api/vision-images')
      .attach('file', Buffer.concat([Buffer.from(PNG), Buffer.alloc(5 * 1024 * 1024)]), { filename: 'big.png', contentType: 'image/png' })
      .expect(400);
    expect(res.body.kind).toBe('validation');
  });

  it("rejects another user's image path as a goal motivation image", async () => {
    await a.post('/api/goals').send({ ...goalBody, motivationImagePath: `${B}/${randomUUID()}.png` }).expect(400);
    await a.post('/api/goals').send({ ...goalBody, motivationImagePath: 'https://evil.com/x.png' }).expect(400);
    const own = (await a.post('/api/goals').send({ ...goalBody, motivationImagePath: `${A}/${randomUUID()}.png` }).expect(200)).body;
    await a.put(`/api/goals/${own.id}`).send({ ...goalBody, motivationImagePath: `${B}/${randomUUID()}.png` }).expect(400);
  });

  it("rejects another user's image path on a vision item", async () => {
    await a.post('/api/vision-items').send({ imagePath: `${B}/${randomUUID()}.png`, quoteText: null }).expect(400);
    await a.post('/api/vision-items').send({ imagePath: `${A}/../${B}/${randomUUID()}.png`, quoteText: null }).expect(400);
    const item = (await a.post('/api/vision-items').send({ imagePath: null, quoteText: 'q' }).expect(200)).body;
    await a.put(`/api/vision-items/${item.id}`).send({ imagePath: `${B}/${randomUUID()}.png`, quoteText: 'q' }).expect(400);
  });

  it("removes the old object when an item's image is replaced or the item is deleted", async () => {
    const first = (await upload()).imagePath;
    const second = (await upload()).imagePath;
    const item = (await a.post('/api/vision-items').send({ imagePath: first, quoteText: null }).expect(200)).body;

    const keep = (await a.put(`/api/vision-items/${item.id}`).send({ imagePath: first, quoteText: 'same image' }).expect(200)).body;
    expect(keep.imagePath).toBe(first);
    expect(store.objects.has(first)).toBe(true);

    const replaced = (await a.put(`/api/vision-items/${item.id}`).send({ imagePath: second, quoteText: null }).expect(200)).body;
    expect(replaced).not.toHaveProperty('oldPath');
    expect(replaced.imagePath).toBe(second);
    expect(store.objects.has(first)).toBe(false);

    await b.delete(`/api/vision-items/${item.id}`).expect(404);
    expect(store.objects.has(second)).toBe(true);
    await a.delete(`/api/vision-items/${item.id}`).expect(204);
    expect(store.objects.has(second)).toBe(false);
  });

  it('keeps the object when the row change fails', async () => {
    const path = (await upload()).imagePath;
    const item = (await a.post('/api/vision-items').send({ imagePath: path, quoteText: null }).expect(200)).body;
    await a.put(`/api/vision-items/${item.id}`).send({ imagePath: null, quoteText: null }).expect(400);
    expect(store.objects.has(path)).toBe(true);
  });

  it('returns imageUrl on created, updated and listed items', async () => {
    const path = (await upload()).imagePath;
    const created = (await a.post('/api/vision-items').send({ imagePath: path, quoteText: null }).expect(200)).body;
    expect(created.imageUrl).toEqual(expect.any(String));
    const quote = (await a.post('/api/vision-items').send({ imagePath: null, quoteText: 'q' }).expect(200)).body;
    expect(quote.imageUrl).toBeNull();
    const listed = (await a.get('/api/vision-items').expect(200)).body;
    expect(listed.find((x: any) => x.id === created.id).imageUrl).toEqual(expect.any(String));
    expect(listed.find((x: any) => x.id === quote.id).imageUrl).toBeNull();
  });
});

describe('settings', () => {
  it('reads and changes theme and grace days', async () => {
    expect((await a.get('/api/settings').expect(200)).body).toHaveProperty('activeTheme');
    expect((await a.put('/api/settings/theme').send({ theme: 'coquette' }).expect(200)).body.activeTheme).toBe('coquette');
    await a.put('/api/settings/theme').send({ theme: 'bogus' }).expect(400);
    expect((await a.put('/api/settings/streak-grace-days').send({ days: 3 }).expect(200)).body.streakGraceDays).toBe(3);
    await a.put('/api/settings/streak-grace-days').send({ days: 8 }).expect(400);
    await a.put('/api/settings/streak-grace-days').send({ days: '3' }).expect(400);
    expect((await b.get('/api/settings').expect(200)).body.activeTheme).not.toBe('coquette');
  });
});

describe('hostile input', () => {
  it.each([
    ['non-text title', '/api/goals', { ...goalBody, title: 123 }],
    ['missing body fields', '/api/goals', {}],
    ['bad enum', '/api/goals', { ...goalBody, timeframe: 'bogus' }],
    ['non-numeric foreign key', '/api/tasks', { ...taskBody, goalId: 'abc' }],
    ['array body', '/api/categories', [1, 2]],
    ['missing tagNames', '/api/ideas', { title: 'x', note: null }],
    ['non-text tag name', '/api/ideas', { title: 'x', note: null, tagNames: [1] }],
    ['tagNames as a string', '/api/ideas', { title: 'x', note: null, tagNames: 'ab' }],
    ['NUL byte in a category name', '/api/categories', { name: 'a\u0000b', colorToken: null }]
  ])('rejects %s with 400 and no SQL text', async (_name, path, body) => {
    const res = await a.post(path).send(body as object).expect(400);
    expect(res.body.kind).toBe('validation');
    expect(JSON.stringify(res.body)).not.toMatch(/violates|syntax|relation|column/i);
  });

  it('rejects non-numeric ids with 400', async () => {
    await a.get('/api/goals/abc').expect(400);
  });

  it('rejects a bogus task status with 400', async () => {
    const task = (await a.post('/api/tasks').send(taskBody).expect(200)).body;
    await a.put(`/api/tasks/${task.id}/status`).send({ status: 'bogus' }).expect(400);
  });
});

describe('profile', () => {
  // Unique per run: a crashed run skips cleanup, and a fixed name would then be taken.
  const NAME = `alpha_${A.slice(0, 8)}`;
  it('reads and sets a unique username', async () => {
    expect((await a.get('/api/profile').expect(200)).body).toEqual({ username: null, avatarUrl: null });
    expect((await a.put('/api/profile/username').send({ username: NAME }).expect(200)).body).toEqual({ username: NAME, avatarUrl: null });
    expect((await a.get('/api/profile').expect(200)).body).toEqual({ username: NAME, avatarUrl: null });
    expect((await b.put('/api/profile/username').send({ username: NAME.toUpperCase() }).expect(400)).body).toEqual({
      kind: 'validation',
      message: 'that username is taken'
    });
    await a.put('/api/profile/username').send({}).expect(400);
  });

  const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  const attachPng = (client: ReturnType<typeof clientFor>) =>
    client.put('/api/profile/avatar').attach('file', Buffer.from(PNG), { filename: 'me.png', contentType: 'image/png' });
  const avatarObjects = (user: string) =>
    [...store.objects.keys()].filter((k) => k.startsWith(`${user}/`));

  it('sets, replaces and removes a profile picture, deleting the old objects', async () => {
    // A picked a username in the test above.
    const before = avatarObjects(A);
    const first = (await attachPng(a).expect(200)).body;
    expect(first).toEqual({ username: NAME, avatarUrl: expect.any(String) });
    expect((await a.get('/api/profile').expect(200)).body.avatarUrl).toEqual(expect.any(String));
    const [firstPath] = avatarObjects(A).filter((k) => !before.includes(k));

    await attachPng(a).expect(200);
    expect(store.objects.has(firstPath)).toBe(false);
    expect(avatarObjects(A)).toHaveLength(before.length + 1);

    expect((await a.delete('/api/profile/avatar').expect(200)).body).toEqual({ username: NAME, avatarUrl: null });
    expect(avatarObjects(A)).toEqual(before);
  });

  it('refuses a picture before a username, without leaving an object behind', async () => {
    const before = avatarObjects(B);
    expect((await attachPng(b).expect(400)).body).toEqual({ kind: 'validation', message: 'pick a username first' });
    expect(avatarObjects(B)).toEqual(before);
  });

  it('rejects a non-image avatar and needs a token', async () => {
    await a.put('/api/profile/avatar').attach('file', Buffer.from('<svg/>'), { filename: 'a.svg', contentType: 'image/svg+xml' }).expect(400);
    await a.put('/api/profile/avatar').send({}).expect(400);
    await request(app).put('/api/profile/avatar').attach('file', Buffer.from(PNG), { filename: 'a.png', contentType: 'image/png' }).expect(401);
  });
});

describe('account deletion', () => {
  const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

  it("removes every row, image and the login, then refuses the user's token", async () => {
    // C is deleted; D is the bystander. Fresh users keep the shared A/B usable.
    const username = `u_${randomUUID().slice(0, 8)}`;
    await c.post('/api/goals').send(goalBody).expect(200);
    await c.post('/api/tasks').send(taskBody).expect(200);
    await c.post('/api/ideas').send({ title: 'I', note: null, tagNames: ['t'] }).expect(200);
    const { imagePath } = (await c
      .post('/api/vision-images')
      .attach('file', Buffer.from(PNG), { filename: 'a.png', contentType: 'image/png' })
      .expect(200)).body;
    await c.post('/api/vision-items').send({ imagePath, quoteText: null }).expect(200);
    await c.put('/api/profile/username').send({ username }).expect(200);
    const dGoal = (await d.post('/api/goals').send(goalBody).expect(200)).body;

    await c.delete('/api/account').expect(204);

    expect(authAdmin.deleted).toEqual([C]);
    expect([...store.objects.keys()].filter((k) => k.startsWith(`${C}/`))).toEqual([]);
    const owner = createPool(process.env.MIGRATE_DATABASE_URL!);
    try {
      for (const table of USER_TABLES) {
        const { rows } = await owner.query(`SELECT 1 FROM ${table} WHERE user_id = $1`, [C]);
        expect(rows, table).toHaveLength(0);
      }
    } finally {
      await owner.end();
    }
    expect(ids((await d.get('/api/goals').expect(200)).body)).toContain(dGoal.id);

    expect((await c.get('/api/goals').expect(401)).body).toEqual({ kind: 'unauthenticated', message: 'account deleted' });
    await c.post('/api/vision-images').attach('file', Buffer.from(PNG), { filename: 'a.png', contentType: 'image/png' }).expect(401);
    await c.delete('/api/account').expect(204);
    expect((await d.put('/api/profile/username').send({ username }).expect(200)).body).toEqual({ username, avatarUrl: null });
  });

  it('records the tombstone before anything else, so a failed deletion leaves the account locked and retryable', async () => {
    const tombstoned = async () =>
      (await pool.query('SELECT 1 FROM deleted_users WHERE user_id = $1', [E])).rowCount === 1;
    const seen: boolean[] = [];
    let failImages = true;
    const flakyStore = {
      ...store,
      async removeAllFor(userId: string) {
        seen.push(await tombstoned());
        if (failImages) throw new Error('storage down');
        await store.removeAllFor(userId);
      }
    };
    const flakyAuth = createMemoryAuthAdmin();
    const flakyApp = createApp({ pool, verify: createVerifier(identity), images: flakyStore, authAdmin: flakyAuth });
    const e = clientFor(flakyApp, await identity.sign({ sub: E }));
    const goal = (await e.post('/api/goals').send(goalBody).expect(200)).body;

    await e.delete('/api/account').expect(500);
    expect(seen).toEqual([true]);
    expect(flakyAuth.deleted).toEqual([]);
    expect((await e.get('/api/goals').expect(401)).body).toEqual({ kind: 'unauthenticated', message: 'account deleted' });
    const owner = createPool(process.env.MIGRATE_DATABASE_URL!);
    try {
      expect((await owner.query('SELECT 1 FROM goals WHERE id = $1', [goal.id])).rows).toHaveLength(1);

      failImages = false;
      await e.delete('/api/account').expect(204);
      expect(flakyAuth.deleted).toEqual([E]);
      expect((await owner.query('SELECT 1 FROM goals WHERE id = $1', [goal.id])).rows).toHaveLength(0);
      expect(await tombstoned()).toBe(true);
    } finally {
      await owner.end();
    }
  });
});
