import { Router } from 'express';
import { AppError } from '../error';
import type { Handle } from '../http';
import { parseDateOrThrow } from '../repo/helpers';
import * as streak from '../repo/streak';

function parseDays(raw: unknown): number {
  if (raw === undefined) return streak.DEFAULT_CELL_DAYS;
  const n = typeof raw === 'string' && /^\d+$/.test(raw) ? Number(raw) : NaN;
  if (!Number.isInteger(n) || n < 1 || n > 366) {
    throw AppError.validation('days must be an integer from 1 to 366');
  }
  return n;
}

/** Mounted at `/`: serves `GET /streaks` and `PUT /tasks/:id/completion`. */
export function streaksRouter(handle: Handle): Router {
  const r = Router();
  r.get('/streaks', handle((db, c) => streak.list(db, parseDays(c.query.days), c.tz)));
  r.put('/tasks/:id/completion', handle((db, c) => {
    const { done, date } = c.body<{ done: unknown; date?: unknown }>();
    if (typeof done !== 'boolean') throw AppError.validation('done must be a boolean');
    if (date !== undefined && date !== null && typeof date !== 'string') {
      throw AppError.validation('date must be YYYY-MM-DD or null');
    }
    const on = typeof date === 'string' ? parseDateOrThrow(date) : null;
    return streak.setCompletion(db, c.id(), on, done, streak.DEFAULT_CELL_DAYS, c.tz);
  }));
  return r;
}
