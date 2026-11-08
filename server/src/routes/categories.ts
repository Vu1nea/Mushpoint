import { Router } from 'express';
import type { Handle } from '../http';
import * as category from '../repo/category';
import type { CategoryInput } from '../types';

export function categoriesRouter(handle: Handle): Router {
  const r = Router();
  r.get('/', handle((db) => category.list(db)));
  r.post('/', handle((db, c) => category.create(db, c.body<CategoryInput>())));
  r.put('/:id', handle((db, c) => category.update(db, c.id(), c.body<CategoryInput>())));
  r.delete('/:id', handle((db, c) => category.remove(db, c.id()), { status: 204 }));
  return r;
}
