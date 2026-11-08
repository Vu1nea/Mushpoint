import { Router } from 'express';
import { AppError } from '../error';
import type { Ctx, Handle } from '../http';
import { isOwnImagePath, type ImageStore } from '../images';
import * as visionItem from '../repo/visionItem';
import type { VisionItem, VisionItemInput } from '../types';
import type { VisionItemView } from '../viewTypes';
import { SIGNED_URL_SECONDS } from './visionImages';

function ownInput(c: Ctx): VisionItemInput {
  const input = c.body<VisionItemInput>();
  if (input.imagePath !== null && input.imagePath !== undefined) {
    if (typeof input.imagePath !== 'string' || !isOwnImagePath(c.userId, input.imagePath)) {
      throw AppError.validation('invalid image path');
    }
  }
  return input;
}

export function visionItemsRouter(handle: Handle, images: ImageStore): Router {
  const r = Router();

  /** One signing call for the whole list. */
  const withUrls = async (items: VisionItem[]): Promise<VisionItemView[]> => {
    const withImage = items.filter((i) => i.imagePath !== null);
    const urls = await images.signedUrls(withImage.map((i) => i.imagePath!), SIGNED_URL_SECONDS);
    const byId = new Map(withImage.map((item, n) => [item.id, urls[n]]));
    return items.map((item) => ({ ...item, imageUrl: byId.get(item.id) ?? null }));
  };
  const one = async (item: VisionItem) => (await withUrls([item]))[0];
  /** Objects are removed only once the row change is durable; a failure leaves
   * an unreferenced object, never a row pointing at nothing. */
  const removeObject = async (path: string | null) => {
    if (path !== null) await images.remove(path);
  };

  r.get('/', handle((db) => visionItem.list(db), { present: withUrls }));
  r.post('/', handle((db, c) => visionItem.create(db, ownInput(c)), { present: one }));
  // Registered before `/:id` so "order" is never read as an id.
  r.put('/order', handle((db, c) => {
    const { orderedIds } = c.body<{ orderedIds: unknown }>();
    if (!Array.isArray(orderedIds) || !orderedIds.every((id) => Number.isSafeInteger(id) && id > 0)) {
      throw AppError.validation('orderedIds must be an array of positive integers');
    }
    return visionItem.reorder(db, orderedIds as number[]);
  }, { status: 204 }));
  r.put('/:id', handle(async (db, c) => {
    const id = c.id();
    const input = ownInput(c);
    const before = await visionItem.get(db, id);
    const item = await visionItem.update(db, id, input);
    const oldPath = before.imagePath !== null && before.imagePath !== item.imagePath ? before.imagePath : null;
    return { item, oldPath };
  }, {
    afterCommit: ({ oldPath }) => removeObject(oldPath),
    present: ({ item }) => one(item)
  }));
  r.delete('/:id', handle(async (db, c) => {
    const id = c.id();
    const { imagePath } = await visionItem.get(db, id);
    await visionItem.remove(db, id);
    return imagePath;
  }, { status: 204, afterCommit: removeObject }));
  return r;
}
