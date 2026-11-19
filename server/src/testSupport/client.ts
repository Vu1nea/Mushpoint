import type { Express } from 'express';
import request from 'supertest';
import { TEST_TZ } from './db';

/** Supertest requests pre-set with a bearer token and `X-Timezone`. */
export function clientFor(app: Express, token: string) {
  const agent = request(app);
  const prep = (req: request.Test) =>
    req.set('Authorization', `Bearer ${token}`).set('X-Timezone', TEST_TZ);
  return {
    get: (path: string) => prep(agent.get(path)),
    post: (path: string) => prep(agent.post(path)),
    put: (path: string) => prep(agent.put(path)),
    delete: (path: string) => prep(agent.delete(path))
  };
}
