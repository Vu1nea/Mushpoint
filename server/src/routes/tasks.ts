import { Router } from 'express';
import type { Handle } from '../http';
import * as task from '../repo/task';
import { taskInput, taskStatusBody, taskUpdate } from '../schemas';

export function tasksRouter(handle: Handle): Router {
  const r = Router();
  r.get('/', handle((db, c) => task.list(db, c.tz)));
  r.post('/', handle((db, c) => task.create(db, c.body(taskInput))));
  r.put('/:id', handle((db, c) => task.update(db, c.id(), c.body(taskUpdate))));
  r.put('/:id/status', handle((db, c) => task.setStatus(db, c.id(), c.body(taskStatusBody).status)));
  r.delete('/:id', handle((db, c) => task.remove(db, c.id()), { status: 204 }));
  return r;
}
