import { Router } from 'express';
import { AppError } from '../error';
import type { Handle } from '../http';
import * as subgoal from '../repo/subgoal';
import type { SubgoalInput, SubgoalUpdate } from '../types';

function requireBoolean(value: unknown): boolean {
  if (typeof value !== 'boolean') throw AppError.validation('isComplete must be a boolean');
  return value;
}

export function subgoalsRouter(handle: Handle): Router {
  const r = Router();
  r.get('/', handle((db) => subgoal.listAll(db)));
  r.post('/', handle((db, c) => subgoal.create(db, c.body<SubgoalInput>())));
  r.put('/:id', handle((db, c) => {
    const body = c.body<SubgoalUpdate>();
    requireBoolean(body.isComplete);
    return subgoal.update(db, c.id(), body);
  }));
  r.put('/:id/complete', handle((db, c) =>
    subgoal.setComplete(db, c.id(), requireBoolean(c.body<{ isComplete: unknown }>().isComplete))
  ));
  r.delete('/:id', handle((db, c) => subgoal.remove(db, c.id()), { status: 204 }));
  return r;
}
