import { Router } from 'express';
import { AppError } from '../error';
import type { Handle } from '../http';
import * as settings from '../repo/settings';

export function settingsRouter(handle: Handle): Router {
  const r = Router();
  r.get('/', handle((db) => settings.get(db)));
  r.put('/theme', handle((db, c) => {
    const { theme } = c.body<{ theme: unknown }>();
    if (typeof theme !== 'string') throw AppError.validation('theme must be text');
    return settings.setTheme(db, theme);
  }));
  r.put('/streak-grace-days', handle((db, c) => {
    const { days } = c.body<{ days: unknown }>();
    if (typeof days !== 'number' || !Number.isInteger(days)) {
      throw AppError.validation('days must be an integer');
    }
    return settings.setGraceDays(db, days);
  }));
  return r;
}
