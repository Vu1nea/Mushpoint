import { Router } from 'express';
import multer from 'multer';
import { checkedUpload, type ImageStore } from '../images';

export const SIGNED_URL_SECONDS = 3600;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Multer middleware for one in-memory image in multipart field `file`. */
export const singleImage = () =>
  multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_IMAGE_BYTES, files: 1 } }).single('file');

/** `POST /` (multipart field `file`). Needs no database; must sit after `authenticate`. */
export function visionImagesRouter(images: ImageStore): Router {
  const r = Router();
  r.post('/', singleImage(), async (req, res) => {
    const { bytes, type } = checkedUpload(req.file);
    const imagePath = await images.put(res.locals.userId, bytes, type);
    const [imageUrl] = await images.signedUrls([imagePath], SIGNED_URL_SECONDS);
    res.json({ imagePath, imageUrl });
  });
  return r;
}
