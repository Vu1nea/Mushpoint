import { randomUUID } from 'node:crypto';
import { generateKeyPair, SignJWT, type JWTVerifyGetKey } from 'jose';

export interface TestIdentity {
  getKey: JWTVerifyGetKey;
  issuer: string;
  audience: string;
  sign(claims?: { sub?: string; iss?: string; aud?: string; expiresIn?: string }): Promise<string>;
}

/** A throwaway ES256 issuer standing in for Supabase's JWKS in tests. */
export async function createTestIdentity(): Promise<TestIdentity> {
  const { publicKey, privateKey } = await generateKeyPair('ES256');
  const issuer = 'https://test.supabase.co/auth/v1';
  const audience = 'authenticated';
  return {
    getKey: async () => publicKey,
    issuer,
    audience,
    sign: ({ sub = randomUUID(), iss = issuer, aud = audience, expiresIn = '1h' } = {}) =>
      new SignJWT({})
        .setProtectedHeader({ alg: 'ES256' })
        .setSubject(sub)
        .setIssuer(iss)
        .setAudience(aud)
        .setIssuedAt()
        .setExpirationTime(expiresIn)
        .sign(privateKey)
  };
}
