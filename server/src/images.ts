import { randomUUID } from 'node:crypto';

export interface ImageStore {
  /** Stores the bytes and returns `<userId>/<uuid>.<ext>`. */
  put(userId: string, bytes: Uint8Array, contentType: string): Promise<string>;
  /** No-op if the object is missing. */
  remove(path: string): Promise<void>;
  /** Same order as `paths`; null where an object cannot be signed. */
  signedUrls(paths: string[], expiresInSeconds: number): Promise<(string | null)[]>;
}

const EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif'
};

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
    async signedUrls(paths, expiresInSeconds) {
      return paths.map((p) =>
        objects.has(p) ? `memory://${p}?expires=${expiresInSeconds}` : null
      );
    }
  };
}
