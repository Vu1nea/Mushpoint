import { Router } from 'express';
import { AppError } from '../error';
import type { Handle } from '../http';
import * as visionItem from '../repo/visionItem';
import type { VisionItemInput } from '../types';

export function visionItemsRouter(handle: Handle): Router {
  const r = Router();
  r.get('/', handle((db) => visionItem.list(db)));
  r.post('/', handle((db, c) => visionItem.create(db, c.body<VisionItemInput>())));
  // Registered before `/:id` so "order" is never read as an id.
  r.put('/order', handle((db, c) => {
    const { orderedIds } = c.body<{ orderedIds: unknown }>();
    if (!Array.isArray(orderedIds) || !orderedIds.every((id) => Number.isSafeInteger(id) && id > 0)) {
      throw AppError.validation('orderedIds must be an array of positive integers');
    }
    return visionItem.reorder(db, orderedIds as number[]);
  }, { status: 204 }));
  r.put('/:id', handle((db, c) => visionItem.update(db, c.id(), c.body<VisionItemInput>())));
  r.delete('/:id', handle((db, c) => visionItem.remove(db, c.id()), { status: 204 }));
  return r;
}
