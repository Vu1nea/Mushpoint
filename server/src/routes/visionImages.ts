import { Router } from 'express';
import multer from 'multer';
import { AppError } from '../error';
import { sniffImageType, type ImageStore } from '../images';

export const SIGNED_URL_SECONDS = 3600;
const MAX_BYTES = 5 * 1024 * 1024;

/** `POST /` (multipart field `file`). Needs no database; must sit after `authenticate`. */
export function visionImagesRouter(images: ImageStore): Router {
  const r = Router();
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES, files: 1 } }).single('file');

  r.post('/', upload, async (req, res) => {
    const file = req.file;
    if (!file || file.size === 0) throw AppError.validation('choose an image to upload');
    const bytes = new Uint8Array(file.buffer);
    const type = sniffImageType(bytes);
    if (type === null || type !== file.mimetype) throw AppError.validation('unsupported image');
    const imagePath = await images.put(res.locals.userId, bytes, type);
    const [imageUrl] = await images.signedUrls([imagePath], SIGNED_URL_SECONDS);
    res.json({ imagePath, imageUrl });
  });
  return r;
}
