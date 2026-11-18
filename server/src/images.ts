import { randomUUID } from 'node:crypto';
import { AppError } from './error';

export interface ImageStore {
  /** Stores the bytes and returns `<userId>/<uuid>.<ext>`. */
  put(userId: string, bytes: Uint8Array, contentType: string): Promise<string>;
  /** No-op if the object is missing. */
  remove(path: string): Promise<void>;
  /** Deletes every object under `<userId>/`; no-op when there are none. */
  removeAllFor(userId: string): Promise<void>;
  /** Same order as `paths`; null where an object cannot be signed. */
  signedUrls(paths: string[], expiresInSeconds: number): Promise<(string | null)[]>;
}

const EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif'
};

type ImageType = 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';

const startsWith = (bytes: Uint8Array, prefix: number[], offset = 0) =>
  bytes.length >= offset + prefix.length && prefix.every((b, i) => bytes[offset + i] === b);
const ascii = (s: string) => [...s].map((ch) => ch.charCodeAt(0));

/** The real type of an upload, judged by its magic bytes, never its declared type. */
export function sniffImageType(bytes: Uint8Array): ImageType | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) return 'image/png';
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(bytes, ascii('GIF87a')) || startsWith(bytes, ascii('GIF89a'))) return 'image/gif';
  if (startsWith(bytes, ascii('RIFF')) && startsWith(bytes, ascii('WEBP'), 8)) return 'image/webp';
  return null;
}

/** Checks a multer upload by its bytes; the declared type must agree with them. */
export function checkedUpload(file: { buffer: Buffer; size: number; mimetype: string } | undefined): {
  bytes: Uint8Array;
  type: ImageType;
} {
  if (!file || file.size === 0) throw AppError.validation('choose an image to upload');
  const bytes = new Uint8Array(file.buffer);
  const type = sniffImageType(bytes);
  if (type === null || type !== file.mimetype) throw AppError.validation('unsupported image');
  return { bytes, type };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True only for `<userId>/<uuid>.<png|jpg|webp|gif>` — no traversal, no other owner. */
export function isOwnImagePath(userId: string, path: string): boolean {
  if (!UUID.test(userId)) return false;
  return new RegExp(
    `^${userId}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(png|jpg|webp|gif)$`,
    'i'
  ).test(path);
}

const LIST_PAGE = 1000;
const DELETE_BATCH = 1000;

/** Supabase Storage REST client (same endpoints as `@supabase/storage-js`). */
export function createSupabaseImageStore(opts: {
  url: string;
  serviceKey: string;
  bucket: string;
  fetch?: typeof fetch;
}): ImageStore {
  const doFetch = opts.fetch ?? fetch;
  const base = `${opts.url.replace(/\/+$/, '')}/storage/v1`;
  const auth = { Authorization: `Bearer ${opts.serviceKey}`, apikey: opts.serviceKey };
  const unavailable = () => new AppError('unavailable', 'image storage failed');

  const call = async (path: string, init: RequestInit) => {
    let res: Response;
    try {
      res = await doFetch(`${base}${path}`, init);
    } catch (err) {
      console.error('image storage request failed', err);
      throw unavailable();
    }
    if (!res.ok) {
      console.error('image storage answered', res.status, await res.text().catch(() => ''));
      throw unavailable();
    }
    return res;
  };

  return {
    async put(userId, bytes, contentType) {
      const ext = EXTENSIONS[contentType];
      if (!ext) throw AppError.validation('unsupported image');
      const path = `${userId}/${randomUUID()}.${ext}`;
      await call(`/object/${opts.bucket}/${path}`, {
        method: 'POST',
        headers: { ...auth, 'Content-Type': contentType, 'x-upsert': 'false' },
        body: new Uint8Array(bytes) // narrows to an ArrayBuffer-backed view, as BodyInit requires
      });
      return path;
    },
    async remove(path) {
      await call(`/object/${opts.bucket}`, {
        method: 'DELETE',
        headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefixes: [path] })
      });
    },
    async removeAllFor(userId) {
      const paths: string[] = [];
      for (let offset = 0; ; offset += LIST_PAGE) {
        const res = await call(`/object/list/${opts.bucket}`, {
          method: 'POST',
          headers: { ...auth, 'Content-Type': 'application/json' },
          body: JSON.stringify({ prefix: userId, limit: LIST_PAGE, offset })
        });
        const page = (await res.json()) as { name: string }[];
        paths.push(...page.map((o) => `${userId}/${o.name}`));
        if (page.length < LIST_PAGE) break;
      }
      // Storage accepts at most 1000 prefixes per delete.
      for (let i = 0; i < paths.length; i += DELETE_BATCH) {
        await call(`/object/${opts.bucket}`, {
          method: 'DELETE',
          headers: { ...auth, 'Content-Type': 'application/json' },
          body: JSON.stringify({ prefixes: paths.slice(i, i + DELETE_BATCH) })
        });
      }
    },
    async signedUrls(paths, expiresInSeconds) {
      if (paths.length === 0) return [];
      const res = await call(`/object/sign/${opts.bucket}`, {
        method: 'POST',
        headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiresIn: expiresInSeconds, paths })
      });
      const entries = (await res.json()) as { path?: string; signedURL?: string | null }[];
      return paths.map((_p, i) => {
        const signed = entries[i]?.signedURL;
        return signed ? encodeURI(`${base}${signed}`) : null;
      });
    }
  };
}

/** In-memory store for tests. */
export function createMemoryImageStore(): ImageStore & { objects: Map<string, Uint8Array> } {
  const objects = new Map<string, Uint8Array>();
  return {
    objects,
    async put(userId, bytes, contentType) {
      const ext = EXTENSIONS[contentType];
      if (!ext) throw new Error(`unsupported content type ${contentType}`);
      const path = `${userId}/${randomUUID()}.${ext}`;
      objects.set(path, bytes);
      return path;
    },
    async remove(path) {
      objects.delete(path);
    },
    async removeAllFor(userId) {
      for (const key of [...objects.keys()]) {
        if (key.startsWith(`${userId}/`)) objects.delete(key);
      }
    },
    async signedUrls(paths, expiresInSeconds) {
      return paths.map((p) =>
        objects.has(p) ? `memory://${p}?expires=${expiresInSeconds}` : null
      );
    }
  };
}
