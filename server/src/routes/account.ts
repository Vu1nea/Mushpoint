import type { RequestHandler } from 'express';
import type { Pool } from 'pg';
import type { AuthAdmin } from '../authAdmin';
import { withUser } from '../db/scope';
import type { ImageStore } from '../images';
import * as account from '../repo/account';

/** `DELETE /account`. Must sit after an `authenticate` with no tombstone check,
 * so a failed deletion can be retried. Each step is idempotent: images, then
 * rows and the tombstone, then the login. */
export function deleteAccount(pool: Pool, images: ImageStore, authAdmin: AuthAdmin): RequestHandler {
  return async (_req, res) => {
    const userId: string = res.locals.userId;
    await images.removeAllFor(userId);
    await withUser(pool, userId, (db) => account.deleteAllRows(db));
    await authAdmin.deleteUser(userId);
    res.status(204).end();
  };
}
