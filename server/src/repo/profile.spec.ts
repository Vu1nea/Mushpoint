import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createTestDb, type TestDb } from '../testSupport/db';
import * as profile from './profile';

let t: TestDb;

beforeEach(async () => {
  t = await createTestDb();
});

afterEach(async () => {
  await t.release();
});

describe('profile', () => {
  it('get returns null username for a new user', async () => {
    expect(await profile.get(t.driver)).toEqual({ username: null });
  });

  it('setUsername trims and stores as typed', async () => {
    expect(await profile.setUsername(t.driver, '  Vinod.G ')).toEqual({ username: 'Vinod.G' });
    expect(await profile.get(t.driver)).toEqual({ username: 'Vinod.G' });
  });

  it.each(['ab', 'a'.repeat(31), 'has space', 'emoji😀'])('setUsername rejects %j', async (name) => {
    await expect(profile.setUsername(t.driver, name)).rejects.toMatchObject({ kind: 'validation' });
  });

  it('setUsername can change own name', async () => {
    await profile.setUsername(t.driver, 'alpha');
    await profile.setUsername(t.driver, 'beta');
    expect(await profile.get(t.driver)).toEqual({ username: 'beta' });
  });

  it('usernames are unique case-insensitively across users', async () => {
    await profile.setUsername(t.driver, 'Vinod');
    await t.useUser(randomUUID());
    await expect(profile.setUsername(t.driver, 'vinod')).rejects.toMatchObject({
      kind: 'validation',
      message: 'that username is taken'
    });
  });

  it("a user cannot read another user's profile", async () => {
    await profile.setUsername(t.driver, 'alpha');
    await t.useUser(randomUUID());
    expect(await profile.get(t.driver)).toEqual({ username: null });
  });
});
