import express, { Router, type Express } from 'express';
import type { Pool } from 'pg';
import type { Verifier } from './auth';
import type { AuthAdmin } from './authAdmin';
import { AppError } from './error';
import { authenticate, errorHandler, makeHandle } from './http';
import type { ImageStore } from './images';
import { log, requestLogger, type Logger } from './logger';
import { createLimiters, DEFAULT_LIMITS, type Limits } from './rateLimit';
import * as idea from './repo/idea';
import { deleteAccount, exportAccount } from './routes/account';
import { categoriesRouter } from './routes/categories';
import { goalsRouter } from './routes/goals';
import { ideasRouter } from './routes/ideas';
import { profileRouter } from './routes/profile';
import { settingsRouter } from './routes/settings';
import { streaksRouter } from './routes/streaks';
import { subgoalsRouter } from './routes/subgoals';
import { tasksRouter } from './routes/tasks';
import { visionImagesRouter } from './routes/visionImages';
import { visionItemsRouter } from './routes/visionItems';

export interface Deps {
  pool: Pool;
  verify: Verifier;
  images: ImageStore;
  authAdmin: AuthAdmin;
  limits?: Limits;
  /** Express `trust proxy` setting: hops of reverse proxy in front of the API,
   * so the per-IP limit sees the client address rather than the proxy's. */
  trustProxy?: number;
  logger?: Logger;
}

export function createApp({ pool, verify, images, authAdmin, limits = DEFAULT_LIMITS, trustProxy = 0, logger = log }: Deps): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', trustProxy);
  const limit = createLimiters(limits);
  app.use(requestLogger(logger));
  // The API only ever answers JSON to authenticated fetches: nothing may render,
  // frame or cache it. Headers for the SPA itself belong to its static server.
  app.use((_req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
      'Cache-Control': 'no-store'
    });
    next();
  });

  const api = Router();
  api.get('/healthz', (_req, res) => {
    res.json({ status: 'ok' });
  });
  // Readiness runs as the app role, so it proves the credentials the API uses.
  // Liveness stays unlimited: a limited liveness probe would restart the pod.
  api.get('/readyz', limit.probes, async (_req, res) => {
    await pool.query('SELECT 1');
    res.json({ status: 'ready' });
  });
  // After the probes, so liveness and readiness checks are never limited.
  api.use(limit.perIp);
  api.use(express.json({ limit: '1mb' }));
  // Before the tombstone check, so a deletion that failed partway can be retried.
  api.delete('/account', authenticate(verify), limit.accountDeletes, deleteAccount(pool, images, authAdmin));
  const isDeleted = async (userId: string) =>
    (await pool.query('SELECT 1 FROM deleted_users WHERE user_id = $1', [userId])).rowCount !== 0;
  api.use(authenticate(verify, isDeleted));

  api.post('/vision-images', limit.uploads);
  api.put('/profile/avatar', limit.uploads);

  const handle = makeHandle(pool);
  api.get('/account/export', limit.accountExports, exportAccount(handle, images));
  api.use('/categories', categoriesRouter(handle));
  api.use('/goals', goalsRouter(handle));
  api.use('/subgoals', subgoalsRouter(handle));
  api.use('/tasks', tasksRouter(handle));
  api.use('/', streaksRouter(handle));
  api.use('/ideas', ideasRouter(handle));
  api.get('/idea-tags', handle((db) => idea.listTags(db)));
  api.use('/vision-items', visionItemsRouter(handle, images));
  api.use('/vision-images', visionImagesRouter(images));
  api.use('/settings', settingsRouter(handle));
  api.use('/profile', profileRouter(handle, pool, images));

  api.use((_req, _res, next) => next(new AppError('not_found', 'no such route')));

  app.use('/api', api);
  app.use(errorHandler);
  return app;
}
