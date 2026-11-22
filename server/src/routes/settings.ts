import { Router } from 'express';
import type { Handle } from '../http';
import * as settings from '../repo/settings';
import { graceDaysBody, themeBody } from '../schemas';

export function settingsRouter(handle: Handle): Router {
  const r = Router();
  r.get('/', handle((db) => settings.get(db)));
  r.put('/theme', handle((db, c) => settings.setTheme(db, c.body(themeBody).theme)));
  r.put('/streak-grace-days', handle((db, c) => settings.setGraceDays(db, c.body(graceDaysBody).days)));
  return r;
}
