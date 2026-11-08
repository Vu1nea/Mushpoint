import { jwtVerify, type JWTVerifyGetKey } from 'jose';
import { AppError } from './error';

export type Verifier = (authorization: string | undefined) => Promise<{ userId: string }>;

const BEARER = /^Bearer (.+)$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Verifies Supabase-issued access tokens. Only asymmetric algorithms are
 * accepted, so a symmetric (HS256) token can never pass as a forged one. */
export function createVerifier({
  getKey,
  issuer,
  audience
}: {
  getKey: JWTVerifyGetKey;
  issuer: string;
  audience: string;
}): Verifier {
  return async (authorization) => {
    const token = BEARER.exec(authorization ?? '')?.[1];
    if (!token) throw AppError.unauthenticated('missing bearer token');
    try {
      const { payload } = await jwtVerify(token, getKey, { issuer, audience, algorithms: ['ES256', 'RS256'] });
      if (typeof payload.sub !== 'string' || !UUID.test(payload.sub)) throw new Error('bad subject');
      return { userId: payload.sub };
    } catch {
      throw AppError.unauthenticated('invalid or expired token');
    }
  };
}
