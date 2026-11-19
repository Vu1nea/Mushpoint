/**
 * Request headers for the Supabase service key.
 *
 * Legacy `service_role` keys are JWTs and go in both `apikey` and
 * `Authorization: Bearer`. The newer `sb_secret_...` keys are not JWTs: they
 * go in `apikey` only, and Supabase's gateway rejects them as a bearer token.
 * Legacy keys are retired in 2027; this keeps both working until then.
 */
export function serviceKeyHeaders(key: string): Record<string, string> {
  return key.startsWith('sb_') ? { apikey: key } : { apikey: key, Authorization: `Bearer ${key}` };
}
