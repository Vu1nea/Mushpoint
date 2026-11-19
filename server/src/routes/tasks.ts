import { Router } from 'express';
import { AppError } from '../error';
import type { Handle } from '../http';
import * as task from '../repo/task';
import type { TaskInput, TaskStatus, TaskUpdate } from '../types';

const STATUSES: readonly TaskStatus[] = ['todo', 'in_progress', 'done'];

export function tasksRouter(handle: Handle): Router {
  const r = Router();
  r.get('/', handle((db, c) => task.list(db, c.tz)));
  r.post('/', handle((db, c) => task.create(db, c.body<TaskInput>())));
  r.put('/:id', handle((db, c) => task.update(db, c.id(), c.body<TaskUpdate>())));
  r.put('/:id/status', handle((db, c) => {
    const { status } = c.body<{ status: unknown }>();
    if (typeof status !== 'string' || !STATUSES.includes(status as TaskStatus)) {
      throw AppError.validation('status must be one of todo, in_progress, done');
    }
    return task.setStatus(db, c.id(), status as TaskStatus);
  }));
  r.delete('/:id', handle((db, c) => task.remove(db, c.id()), { status: 204 }));
  return r;
}
