import { AppError } from './error';

export interface AuthAdmin {
  /** Removes the Supabase login; succeeds when it is already gone. */
  deleteUser(userId: string): Promise<void>;
}

/** Supabase Auth admin REST client (same endpoint as `auth.admin.deleteUser`). */
export function createSupabaseAuthAdmin(opts: {
  url: string;
  serviceKey: string;
  fetch?: typeof fetch;
}): AuthAdmin {
  const doFetch = opts.fetch ?? fetch;
  const base = `${opts.url.replace(/\/+$/, '')}/auth/v1/admin/users`;
  const unavailable = () => new AppError('unavailable', 'could not delete the login');

  return {
    async deleteUser(userId) {
      let res: Response;
      try {
        res = await doFetch(`${base}/${encodeURIComponent(userId)}`, {
          method: 'DELETE',
          headers: { apikey: opts.serviceKey, Authorization: `Bearer ${opts.serviceKey}` }
        });
      } catch (err) {
        console.error('auth admin request failed', err);
        throw unavailable();
      }
      if (res.ok || res.status === 404) return;
      console.error('auth admin answered', res.status, await res.text().catch(() => ''));
      throw unavailable();
    }
  };
}

/** In-memory admin for tests; records each deleted id. */
export function createMemoryAuthAdmin(): AuthAdmin & { deleted: string[] } {
  const deleted: string[] = [];
  return {
    deleted,
    async deleteUser(userId) {
      deleted.push(userId);
    }
  };
}
