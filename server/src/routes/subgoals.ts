import { Router } from 'express';
import type { Handle } from '../http';
import * as subgoal from '../repo/subgoal';
import { isCompleteBody, subgoalInput, subgoalUpdate } from '../schemas';

export function subgoalsRouter(handle: Handle): Router {
  const r = Router();
  r.get('/', handle((db) => subgoal.listAll(db)));
  r.post('/', handle((db, c) => subgoal.create(db, c.body(subgoalInput))));
  r.put('/:id', handle((db, c) => subgoal.update(db, c.id(), c.body(subgoalUpdate))));
  r.put('/:id/complete', handle((db, c) =>
    subgoal.setComplete(db, c.id(), c.body(isCompleteBody).isComplete)));
  r.delete('/:id', handle((db, c) => subgoal.remove(db, c.id()), { status: 204 }));
  return r;
}
