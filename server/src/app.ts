import express, { Router, type Express } from 'express';
import type { Pool } from 'pg';
import type { Verifier } from './auth';
import type { AuthAdmin } from './authAdmin';
import { AppError } from './error';
import { authenticate, errorHandler, makeHandle } from './http';
import type { ImageStore } from './images';
import * as idea from './repo/idea';
import { deleteAccount } from './routes/account';
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
}

export function createApp({ pool, verify, images, authAdmin }: Deps): Express {
  const app = express();
  app.disable('x-powered-by');

  const api = Router();
  api.get('/healthz', (_req, res) => {
    res.json({ status: 'ok' });
  });
  // Readiness runs as the app role, so it proves the credentials the API uses.
  api.get('/readyz', async (_req, res) => {
    await pool.query('SELECT 1');
    res.json({ status: 'ready' });
  });
  api.use(express.json({ limit: '1mb' }));
  // Before the tombstone check, so a deletion that failed partway can be retried.
  api.delete('/account', authenticate(verify), deleteAccount(pool, images, authAdmin));
  const isDeleted = async (userId: string) =>
    (await pool.query('SELECT 1 FROM deleted_users WHERE user_id = $1', [userId])).rowCount !== 0;
  api.use(authenticate(verify, isDeleted));

  const handle = makeHandle(pool);
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
  api.use('/profile', profileRouter(handle));

  api.use((_req, _res, next) => next(new AppError('not_found', 'no such route')));

  app.use('/api', api);
  app.use(errorHandler);
  return app;
}
