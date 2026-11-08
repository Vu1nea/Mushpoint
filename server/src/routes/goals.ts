import { Router } from 'express';
import { AppError } from '../error';
import type { Handle } from '../http';
import * as goal from '../repo/goal';
import type { GoalInput, GoalStatus } from '../types';

const STATUSES: readonly GoalStatus[] = ['active', 'completed', 'archived'];

function parseStatus(raw: unknown): GoalStatus {
  if (typeof raw !== 'string' || !STATUSES.includes(raw as GoalStatus)) {
    throw AppError.validation('status must be one of active, completed, archived');
  }
  return raw as GoalStatus;
}

export function goalsRouter(handle: Handle): Router {
  const r = Router();
  r.get('/', handle((db, c) => {
    const status = c.query.status === undefined ? null : parseStatus(c.query.status);
    return goal.list(db, status, c.tz);
  }));
  r.get('/:id', handle((db, c) => goal.getDetail(db, c.id(), c.tz)));
  r.post('/', handle((db, c) => goal.create(db, c.body<GoalInput>())));
  r.put('/:id', handle((db, c) => goal.update(db, c.id(), c.body<GoalInput>())));
  r.put('/:id/status', handle((db, c) =>
    goal.setStatus(db, c.id(), parseStatus(c.body<{ status: unknown }>().status))
  ));
  r.delete('/:id', handle((db, c) => {
    const flag = c.query.deleteOrphanedTasks;
    if (flag !== undefined && flag !== 'true' && flag !== 'false') {
      throw AppError.validation('deleteOrphanedTasks must be true or false');
    }
    return goal.remove(db, c.id(), flag === 'true');
  }, { status: 204 }));
  return r;
}
