import { Router } from 'express';
import { AppError } from '../error';
import type { Handle } from '../http';
import * as idea from '../repo/idea';
import type { IdeaInput } from '../types';

export function ideasRouter(handle: Handle): Router {
  const r = Router();
  r.get('/', handle((db, c) => {
    const { tag, includePromoted } = c.query;
    if (tag !== undefined && typeof tag !== 'string') throw AppError.validation('tag must be text');
    if (includePromoted !== undefined && includePromoted !== 'true' && includePromoted !== 'false') {
      throw AppError.validation('includePromoted must be true or false');
    }
    return idea.list(db, { tag: tag || undefined, includePromoted: includePromoted === 'true' });
  }));
  r.get('/:id', handle((db, c) => idea.get(db, c.id())));
  r.post('/', handle((db, c) => idea.create(db, c.body<IdeaInput>())));
  r.put('/:id', handle((db, c) => idea.update(db, c.id(), c.body<IdeaInput>())));
  r.delete('/:id', handle((db, c) => idea.remove(db, c.id()), { status: 204 }));
  r.post('/:id/promote', handle((db, c) => {
    const { goalId } = c.body<{ goalId: unknown }>();
    if (typeof goalId !== 'number' || !Number.isSafeInteger(goalId) || goalId <= 0) {
      throw AppError.validation('goalId must be a positive integer');
    }
    return idea.promote(db, c.id(), goalId);
  }));
  return r;
}
