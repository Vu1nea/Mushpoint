import express, { Router, type Express } from 'express';
import type { Pool } from 'pg';
import type { Verifier } from './auth';
import { AppError } from './error';
import { authenticate, errorHandler } from './http';
import type { ImageStore } from './images';

export interface Deps {
  pool: Pool;
  verify: Verifier;
  images: ImageStore;
}

export function createApp({ pool, verify }: Deps): Express {
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
  api.use(authenticate(verify));
  // Data routers are mounted here in Tasks 9-10.
  api.use((_req, _res, next) => next(new AppError('not_found', 'no such route')));

  app.use('/api', api);
  app.use(errorHandler);
  return app;
}
