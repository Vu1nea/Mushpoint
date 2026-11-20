import { Router } from 'express';
import type { Handle } from '../http';
import * as idea from '../repo/idea';
import { ideaInput, ideaListQuery } from '../schemas';
import { ownGoalInput } from './goals';

export function ideasRouter(handle: Handle): Router {
  const r = Router();
  r.get('/', handle((db, c) => {
    const { tag, includePromoted } = c.query(ideaListQuery);
    return idea.list(db, { tag: tag || undefined, includePromoted });
  }));
  r.get('/:id', handle((db, c) => idea.get(db, c.id())));
  r.post('/', handle((db, c) => idea.create(db, c.body(ideaInput))));
  r.put('/:id', handle((db, c) => idea.update(db, c.id(), c.body(ideaInput))));
  r.delete('/:id', handle((db, c) => idea.remove(db, c.id()), { status: 204 }));
  /** Body is a new goal's fields. The goal is created and the idea promoted in
   * one transaction, so a failure leaves neither behind. */
  r.post('/:id/promote', handle((db, c) => idea.promoteToNewGoal(db, c.id(), ownGoalInput(c))));
  return r;
}
