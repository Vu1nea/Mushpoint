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
    expect(await profile.get(t.driver)).toEqual({ username: null, avatarPath: null });
  });

  it('setUsername trims and stores as typed', async () => {
    expect(await profile.setUsername(t.driver, '  Vinod.G ')).toEqual({ username: 'Vinod.G', avatarPath: null });
    expect(await profile.get(t.driver)).toEqual({ username: 'Vinod.G', avatarPath: null });
  });

  it.each(['ab', 'a'.repeat(31), 'has space', 'emoji😀'])('setUsername rejects %j', async (name) => {
    await expect(profile.setUsername(t.driver, name)).rejects.toMatchObject({ kind: 'validation' });
  });

  it('setUsername can change own name', async () => {
    await profile.setUsername(t.driver, 'alpha');
    await profile.setUsername(t.driver, 'beta');
    expect(await profile.get(t.driver)).toEqual({ username: 'beta', avatarPath: null });
  });

  it('usernames are unique case-insensitively across users', async () => {
    await profile.setUsername(t.driver, 'Vinod');
    await t.useUser(randomUUID());
    await expect(profile.setUsername(t.driver, 'vinod')).rejects.toMatchObject({
      kind: 'validation',
      message: 'that username is taken'
    });
  });

  it('setAvatar needs a profile row', async () => {
    await expect(profile.setAvatar(t.driver, 'x/y.png')).rejects.toMatchObject({ kind: 'validation' });
  });

  it('setAvatar stores, replaces and clears, reporting the replaced path', async () => {
    await profile.setUsername(t.driver, 'alpha');
    expect(await profile.setAvatar(t.driver, 'u/one.png')).toEqual({
      profile: { username: 'alpha', avatarPath: 'u/one.png' },
      replaced: null
    });
    expect((await profile.setAvatar(t.driver, 'u/two.png')).replaced).toBe('u/one.png');
    expect(await profile.setAvatar(t.driver, null)).toEqual({
      profile: { username: 'alpha', avatarPath: null },
      replaced: 'u/two.png'
    });
  });

  it('setUsername keeps the avatar', async () => {
    await profile.setUsername(t.driver, 'alpha');
    await profile.setAvatar(t.driver, 'u/one.png');
    expect(await profile.setUsername(t.driver, 'beta')).toEqual({ username: 'beta', avatarPath: 'u/one.png' });
  });

  it("a user cannot read another user's profile", async () => {
    await profile.setUsername(t.driver, 'alpha');
    await t.useUser(randomUUID());
    expect(await profile.get(t.driver)).toEqual({ username: null, avatarPath: null });
  });
});
