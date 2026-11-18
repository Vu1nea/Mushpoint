import { Router } from 'express';
import type { Pool } from 'pg';
import { withUser } from '../db/scope';
import { AppError } from '../error';
import type { Handle } from '../http';
import { checkedUpload, type ImageStore } from '../images';
import * as profile from '../repo/profile';
import type { Profile } from '../types';
import { SIGNED_URL_SECONDS, singleImage } from './visionImages';

export function profileRouter(handle: Handle, pool: Pool, images: ImageStore): Router {
  const r = Router();

  const present = async ({ username, avatarPath }: profile.StoredProfile): Promise<Profile> => {
    if (avatarPath === null) return { username, avatarUrl: null };
    const [avatarUrl] = await images.signedUrls([avatarPath], SIGNED_URL_SECONDS);
    return { username, avatarUrl };
  };
  /** Old objects go only once the row change is durable; a failure leaves an
   * unreferenced object, never a profile pointing at nothing. */
  const removeObject = async (path: string | null) => {
    if (path !== null) await images.remove(path);
  };

  r.get('/', handle((db) => profile.get(db), { present }));
  r.put('/username', handle((db, c) => {
    const { username } = c.body<{ username: unknown }>();
    if (typeof username !== 'string') throw AppError.validation('username must be text');
    return profile.setUsername(db, username);
  }, { present }));

  /** `PUT /avatar` (multipart field `file`): stores the picture, then points the profile at it. */
  r.put('/avatar', singleImage(), async (req, res) => {
    const userId: string = res.locals.userId;
    const { bytes, type } = checkedUpload(req.file);
    const path = await images.put(userId, bytes, type);
    let result: Awaited<ReturnType<typeof profile.setAvatar>>;
    try {
      result = await withUser(pool, userId, (db) => profile.setAvatar(db, path));
    } catch (err) {
      await removeObject(path).catch((e) => console.error('could not remove unused avatar', e));
      throw err;
    }
    await removeObject(result.replaced).catch((e) => console.error('could not remove old avatar', e));
    res.json(await present(result.profile));
  });
  r.delete('/avatar', handle((db) => profile.setAvatar(db, null), {
    afterCommit: ({ replaced }) => removeObject(replaced),
    present: ({ profile: p }) => present(p)
  }));
  return r;
}
