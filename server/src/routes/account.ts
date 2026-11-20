import type { RequestHandler } from 'express';
import type { Handle } from '../http';
import type { Pool } from 'pg';
import type { AuthAdmin } from '../authAdmin';
import { withUser } from '../db/scope';
import type { ImageStore } from '../images';
import * as account from '../repo/account';

/** `DELETE /account`. Must sit after an `authenticate` with no tombstone check,
 * so a failed deletion can be retried. Each step is idempotent: the tombstone
 * first (it locks the account out of every other route), then images, then
 * rows, then the login. */
/** How long the image links in an export stay valid. */
export const EXPORT_LINK_SECONDS = 24 * 60 * 60;

/** `GET /account/export`: everything stored about the caller, for UK GDPR access
 * and portability requests (Articles 15 and 20). Rows come straight from every
 * table in `USER_TABLES`, so a new table is exported as soon as it is listed
 * there. Images are links, signed after the transaction commits. The sign-in
 * email lives in Supabase Auth, not here. */
export function exportAccount(handle: Handle, images: ImageStore): RequestHandler {
  return handle(async (db, c) => ({ userId: c.userId, tables: await account.exportAllRows(db) }), {
    present: async ({ userId, tables }) => {
      const paths = account.imagePathsIn(tables);
      const urls = paths.length ? await images.signedUrls(paths, EXPORT_LINK_SECONDS) : [];
      const exportedAt = new Date();
      return {
        format: 'mushpoint-export',
        version: 1,
        exportedAt: exportedAt.toISOString(),
        userId,
        note:
          'Every record Mushpoint stores for this account. Image links expire at imageLinksExpireAt; ' +
          'export again for fresh ones. The sign-in email is held by the authentication provider (Supabase).',
        imageLinksExpireAt: new Date(exportedAt.getTime() + EXPORT_LINK_SECONDS * 1000).toISOString(),
        tables,
        images: paths.map((path, i) => ({ path, url: urls[i] ?? null }))
      };
    }
  });
}

export function deleteAccount(pool: Pool, images: ImageStore, authAdmin: AuthAdmin): RequestHandler {
  return async (_req, res) => {
    const userId: string = res.locals.userId;
    await account.recordTombstone(pool, userId);
    await images.removeAllFor(userId);
    await withUser(pool, userId, (db) => account.deleteAllRows(db));
    await authAdmin.deleteUser(userId);
    res.status(204).end();
  };
}
