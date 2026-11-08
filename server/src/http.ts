import type { ErrorRequestHandler, Request, RequestHandler } from 'express';
import multer from 'multer';
import type { Pool } from 'pg';
import type { Verifier } from './auth';
import type { SqlDriver } from './db/driver';
import { withUser } from './db/scope';
import { AppError, type ErrorKind } from './error';
import { parseTimezone } from './repo/helpers';

export interface Ctx {
  userId: string;
  tz: string;
  id(name?: string): number;
  body<T>(): T;
  query: Request['query'];
}

export type Handle = <T>(
  fn: (driver: SqlDriver, ctx: Ctx) => Promise<T>,
  /** afterCommit runs after COMMIT; its failure is logged, never sent to the client. */
  opts?: { status?: number; afterCommit?: (result: T) => Promise<void> }
) => RequestHandler;

/** Verifies the bearer token and stores the user id; Express 5 forwards the rejection. */
export function authenticate(verify: Verifier): RequestHandler {
  return async (req, res, next) => {
    res.locals.userId = (await verify(req.header('authorization'))).userId;
    next();
  };
}

/** Wraps a route body in one user-scoped transaction. */
export function makeHandle(pool: Pool): Handle {
  return (fn, { status = 200, afterCommit } = {}) =>
    async (req, res) => {
      const userId: string = res.locals.userId;
      const ctx: Ctx = {
        userId,
        get tz() {
          return parseTimezone(req.header('x-timezone'));
        },
        id(name = 'id') {
          const raw = req.params[name];
          const n = typeof raw === 'string' && /^\d+$/.test(raw) ? Number(raw) : NaN;
          if (!Number.isSafeInteger(n) || n <= 0) throw AppError.validation('invalid id');
          return n;
        },
        body<T>() {
          const b: unknown = req.body;
          if (typeof b !== 'object' || b === null || Array.isArray(b)) {
            throw AppError.validation('request body must be a JSON object');
          }
          return b as T;
        },
        query: req.query
      };
      const result = await withUser(pool, userId, (driver) => fn(driver, ctx));
      if (afterCommit) {
        await afterCommit(result).catch((err) => console.error('afterCommit failed', err));
      }
      if (status === 204) res.status(204).end();
      else res.status(status).json(result);
    };
}

const STATUS: Record<ErrorKind, number> = {
  validation: 400,
  unauthenticated: 401,
  not_found: 404,
  database: 500,
  internal: 500,
  unavailable: 503
};

const INTERNAL = { kind: 'internal', message: 'internal error' } as const;

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    const status = STATUS[err.kind] ?? 500;
    if (err.kind === 'database' || err.kind === 'internal') {
      console.error(err);
      res.status(status).json({ kind: err.kind, message: 'internal error' });
    } else {
      res.status(status).json({ kind: err.kind, message: err.message });
    }
    return;
  }

  const type = (err as { type?: unknown })?.type;
  if (type === 'entity.parse.failed') {
    res.status(400).json({ kind: 'validation', message: 'malformed JSON body' });
    return;
  }
  if (type === 'entity.too.large') {
    res.status(400).json({ kind: 'validation', message: 'request body too large' });
    return;
  }
  if (err instanceof multer.MulterError) {
    res.status(400).json({ kind: 'validation', message: 'invalid upload' });
    return;
  }

  const code = (err as { code?: unknown })?.code;
  if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) {
    if (code === '23505') {
      res.status(400).json({ kind: 'validation', message: 'that value already exists' });
      return;
    }
    if (code.startsWith('22') || code.startsWith('23')) {
      res.status(400).json({ kind: 'validation', message: 'invalid value' });
      return;
    }
  }

  console.error(err);
  res.status(500).json(INTERNAL);
};
