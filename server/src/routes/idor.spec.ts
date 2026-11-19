/* eslint-disable @typescript-eslint/no-explicit-any */
// IDOR sweep: user B aims every id-taking route at user A's records. Each must
// answer 404 (never 200/204, never a 403 that confirms the id exists), and A's
// data must be unchanged afterwards. Add a row here for every new :id route.
import { randomUUID } from 'node:crypto';
import type { Express } from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { createVerifier } from '../auth';
import { createMemoryAuthAdmin } from '../authAdmin';
import { createPool } from '../db/pool';
import { createMemoryImageStore } from '../images';
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
let a: ReturnType<typeof clientFor>;
let b: ReturnType<typeof clientFor>;
const own: Record<string, any> = {};

beforeAll(async () => {
  const identity = await createTestIdentity();
  const app: Express = createApp({
    pool,
    verify: createVerifier(identity),
    images: createMemoryImageStore(),
    authAdmin: createMemoryAuthAdmin()
  });
  a = clientFor(app, await identity.sign({ sub: A }));
  b = clientFor(app, await identity.sign({ sub: B }));

  own.category = (await a.post('/api/categories').send({ name: 'Mine', colorToken: null }).expect(200)).body;
  own.goal = (await a.post('/api/goals').send({ ...goalBody, categoryId: own.category.id }).expect(200)).body;
  own.subgoal = (await a.post('/api/subgoals').send({ goalId: own.goal.id, title: 'S', dueDate: null }).expect(200)).body;
  own.task = (await a.post('/api/tasks').send({ ...taskBody, goalId: own.goal.id, recurrence: 'daily' }).expect(200)).body;
  own.idea = (await a.post('/api/ideas').send({ title: 'I', note: null, tagNames: [] }).expect(200)).body;
  own.vision = (await a.post('/api/vision-items').send({ imagePath: null, quoteText: 'Q' }).expect(200)).body;
});

afterAll(async () => {
  await purgeUsers([A, B]);
  await pool.end();
});

type Method = 'get' | 'put' | 'post' | 'delete';
const attacks: [string, Method, () => string, () => object | undefined][] = [
  ['read goal detail', 'get', () => `/api/goals/${own.goal.id}`, () => undefined],
  ['update goal', 'put', () => `/api/goals/${own.goal.id}`, () => goalBody],
  ['change goal status', 'put', () => `/api/goals/${own.goal.id}/status`, () => ({ status: 'archived' })],
  ['delete goal', 'delete', () => `/api/goals/${own.goal.id}`, () => undefined],
  ['update category', 'put', () => `/api/categories/${own.category.id}`, () => ({ name: 'X', colorToken: null })],
  ['delete category', 'delete', () => `/api/categories/${own.category.id}`, () => undefined],
  ['update subgoal', 'put', () => `/api/subgoals/${own.subgoal.id}`, () => ({ title: 'X', dueDate: null, isComplete: false })],
  ['complete subgoal', 'put', () => `/api/subgoals/${own.subgoal.id}/complete`, () => ({ isComplete: true })],
  ['delete subgoal', 'delete', () => `/api/subgoals/${own.subgoal.id}`, () => undefined],
  ['update task', 'put', () => `/api/tasks/${own.task.id}`, () => ({ ...taskBody, status: 'done' })],
  ['change task status', 'put', () => `/api/tasks/${own.task.id}/status`, () => ({ status: 'done' })],
  ['mark habit done', 'put', () => `/api/tasks/${own.task.id}/completion`, () => ({ done: true })],
  ['delete task', 'delete', () => `/api/tasks/${own.task.id}`, () => undefined],
  ['read idea', 'get', () => `/api/ideas/${own.idea.id}`, () => undefined],
  ['update idea', 'put', () => `/api/ideas/${own.idea.id}`, () => ({ title: 'X', note: null, tagNames: [] })],
  ['promote idea', 'post', () => `/api/ideas/${own.idea.id}/promote`, () => goalBody],
  ['delete idea', 'delete', () => `/api/ideas/${own.idea.id}`, () => undefined],
  ['update vision item', 'put', () => `/api/vision-items/${own.vision.id}`, () => ({ imagePath: null, quoteText: 'X' })],
  ['delete vision item', 'delete', () => `/api/vision-items/${own.vision.id}`, () => undefined],
  // Pointing B's new records at A's parents.
  ['create goal in their category', 'post', () => '/api/goals', () => ({ ...goalBody, categoryId: own.category.id })],
  ['create subgoal under their goal', 'post', () => '/api/subgoals', () => ({ goalId: own.goal.id, title: 'S', dueDate: null })],
  ['create task under their goal', 'post', () => '/api/tasks', () => ({ ...taskBody, goalId: own.goal.id })],
  ['create task under their subgoal', 'post', () => '/api/tasks', () => ({ ...taskBody, goalId: own.goal.id, subgoalId: own.subgoal.id })]
];

describe('IDOR sweep', () => {
  it.each(attacks)('another user cannot %s', async (_name, method, path, body) => {
    const req = b[method](path());
    const res = await (body() ? req.send(body()) : req);
    expect(res.status).toBe(404);
  });

  it("leaves the owner's records untouched after every attempt", async () => {
    const goal = (await a.get(`/api/goals/${own.goal.id}`).expect(200)).body;
    expect(goal).toMatchObject({ title: 'G', status: 'active', categoryId: own.category.id });
    expect((await a.get('/api/categories').expect(200)).body.map((c: any) => c.name)).toContain('Mine');
    const sub = (await a.get('/api/subgoals').expect(200)).body.find((s: any) => s.id === own.subgoal.id);
    expect(sub).toMatchObject({ title: 'S', isComplete: false });
    const task = (await a.get('/api/tasks').expect(200)).body.find((t: any) => t.id === own.task.id);
    expect(task).toMatchObject({ title: 'T', status: 'todo' });
    const habit = (await a.get('/api/streaks?days=1').expect(200)).body.find((c: any) => c.task.id === own.task.id);
    expect(habit.doneToday).toBe(false);
    expect((await a.get(`/api/ideas/${own.idea.id}`).expect(200)).body).toMatchObject({ title: 'I', promotedGoalId: null });
    const vision = (await a.get('/api/vision-items').expect(200)).body.find((v: any) => v.id === own.vision.id);
    expect(vision).toMatchObject({ quoteText: 'Q' });
    expect((await b.get('/api/goals').expect(200)).body).toEqual([]);
    expect((await b.get('/api/tasks').expect(200)).body).toEqual([]);
  });
});
