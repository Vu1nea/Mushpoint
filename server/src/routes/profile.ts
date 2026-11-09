import { Router } from 'express';
import { AppError } from '../error';
import type { Handle } from '../http';
import * as profile from '../repo/profile';

export function profileRouter(handle: Handle): Router {
  const r = Router();
  r.get('/', handle((db) => profile.get(db)));
  r.put('/username', handle((db, c) => {
    const { username } = c.body<{ username: unknown }>();
    if (typeof username !== 'string') throw AppError.validation('username must be text');
    return profile.setUsername(db, username);
  }));
  return r;
}
