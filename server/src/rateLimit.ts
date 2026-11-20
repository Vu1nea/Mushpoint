import type { RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';

/** Requests allowed per window. Counters live in process memory, so with N
 * replicas the effective limit is up to N times higher; the ingress limit is
 * the shared backstop. */
export interface Limits {
  /** Any /api request from one client address, per minute. */
  perIp: number;
  /** `/readyz` checks from one client address, per minute. Separate from
   * `perIp` so app traffic can't starve probes, but bounded because each
   * check queries the database and the route needs no login. */
  probes: number;
  /** Image uploads (vision board and avatar) by one user, per 15 minutes. */
  uploads: number;
  /** `DELETE /account` attempts by one user, per hour. */
  accountDeletes: number;
  /** `GET /account/export` requests by one user, per hour. */
  accountExports: number;
}

export const DEFAULT_LIMITS: Limits = { perIp: 600, probes: 120, uploads: 30, accountDeletes: 5, accountExports: 10 };

const MINUTE = 60_000;

function limiter(limit: number, windowMs: number, key?: 'user'): RequestHandler {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    // Per-user limiters run after `authenticate`, so the verified id is set.
    ...(key === 'user' ? { keyGenerator: (_req, res) => res.locals.userId as string } : {}),
    handler: (_req, res) => {
      res.status(429).json({ kind: 'unavailable', message: 'too many requests, try again shortly' });
    }
  });
}

export function createLimiters(limits: Limits) {
  return {
    perIp: limiter(limits.perIp, MINUTE),
    probes: limiter(limits.probes, MINUTE),
    uploads: limiter(limits.uploads, 15 * MINUTE, 'user'),
    accountDeletes: limiter(limits.accountDeletes, 60 * MINUTE, 'user'),
    accountExports: limiter(limits.accountExports, 60 * MINUTE, 'user')
  };
}
