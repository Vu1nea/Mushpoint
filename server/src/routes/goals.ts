import { Router } from 'express';
import { AppError } from '../error';
import type { Ctx, Handle } from '../http';
import { isOwnImagePath } from '../images';
import * as goal from '../repo/goal';
import { goalDeleteQuery, goalInput, goalListQuery, goalStatusBody } from '../schemas';
import type { GoalInput } from '../types';

/** The body as a goal, refusing a motivation image that is not one of the caller's uploads. */
export function ownGoalInput(c: Ctx): GoalInput {
  const input = c.body(goalInput);
  const path = input.motivationImagePath?.trim();
  if (path && !isOwnImagePath(c.userId, path)) throw AppError.validation('invalid image path');
  return input;
}

export function goalsRouter(handle: Handle): Router {
  const r = Router();
  r.get('/', handle((db, c) => goal.list(db, c.query(goalListQuery).status ?? null, c.tz)));
  r.get('/:id', handle((db, c) => goal.getDetail(db, c.id(), c.tz)));
  r.post('/', handle((db, c) => goal.create(db, ownGoalInput(c))));
  r.put('/:id', handle((db, c) => goal.update(db, c.id(), ownGoalInput(c))));
  r.put('/:id/status', handle((db, c) => goal.setStatus(db, c.id(), c.body(goalStatusBody).status)));
  r.delete('/:id', handle((db, c) =>
    goal.remove(db, c.id(), c.query(goalDeleteQuery).deleteOrphanedTasks), { status: 204 }));
  return r;
}
