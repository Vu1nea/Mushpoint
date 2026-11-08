import { randomUUID } from 'node:crypto';
import { SignJWT } from 'jose';
import { beforeAll, describe, expect, it } from 'vitest';
import { createVerifier, type Verifier } from './auth';
import { createTestIdentity, type TestIdentity } from './testSupport/auth';

describe('createVerifier', () => {
  let identity: TestIdentity;
  let verify: Verifier;

  beforeAll(async () => {
    identity = await createTestIdentity();
    verify = createVerifier(identity);
  });

  const rejects = (header: string | undefined) =>
    expect(verify(header)).rejects.toMatchObject({ kind: 'unauthenticated' });

  it('accepts a valid token and returns the user id', async () => {
    const sub = randomUUID();
    await expect(verify(`Bearer ${await identity.sign({ sub })}`)).resolves.toEqual({ userId: sub });
  });

  it.each([
    ['no header', undefined],
    ['wrong scheme', 'Basic abc'],
    ['garbage', 'Bearer not.a.jwt']
  ])('rejects %s', async (_name, header) => {
    await rejects(header);
  });

  it('rejects an expired token', async () => {
    await rejects(`Bearer ${await identity.sign({ expiresIn: '-1m' })}`);
  });

  it('rejects the wrong issuer', async () => {
    await rejects(`Bearer ${await identity.sign({ iss: 'https://evil.example/auth/v1' })}`);
  });

  it('rejects the wrong audience', async () => {
    await rejects(`Bearer ${await identity.sign({ aud: 'anon' })}`);
  });

  it('rejects a token signed by a different key', async () => {
    const other = await createTestIdentity();
    await rejects(`Bearer ${await other.sign()}`);
  });

  it('rejects an HS256 token (algorithm confusion)', async () => {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(randomUUID())
      .setIssuer(identity.issuer)
      .setAudience(identity.audience)
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode('a-shared-secret-that-is-long-enough-for-hs256'));
    await rejects(`Bearer ${token}`);
  });

  it('rejects a token whose sub is not a uuid', async () => {
    await rejects(`Bearer ${await identity.sign({ sub: 'admin' })}`);
  });
});
