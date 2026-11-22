import { Router } from 'express';
import type { Handle } from '../http';
import { parseDateOrThrow } from '../repo/helpers';
import * as streak from '../repo/streak';
import { completionBody, streakQuery } from '../schemas';

/** Mounted at `/`: serves `GET /streaks` and `PUT /tasks/:id/completion`. */
export function streaksRouter(handle: Handle): Router {
  const r = Router();
  r.get('/streaks', handle((db, c) =>
    streak.list(db, c.query(streakQuery).days ?? streak.DEFAULT_CELL_DAYS, c.tz)));
  r.put('/tasks/:id/completion', handle((db, c) => {
    const { done, date } = c.body(completionBody);
    const on = date === null ? null : parseDateOrThrow(date);
    return streak.setCompletion(db, c.id(), on, done, streak.DEFAULT_CELL_DAYS, c.tz);
  }));
  return r;
}
