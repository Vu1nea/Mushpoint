import { DEFAULT_LIMITS } from './rateLimit';

export interface Config {
  databaseUrl: string;
  supabaseUrl: string;
  supabaseServiceKey: string;
  port: number;
  imageBucket: string;
  /** Reverse-proxy hops in front of the API (Express `trust proxy`). */
  trustProxy: number;
  /** /api requests allowed per client address per minute. */
  rateLimitPerIp: number;
}

const REQUIRED = ['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY'] as const;

/** Reads the API's settings; fails fast naming every missing variable. */
export function loadConfig(env: NodeJS.ProcessEnv): Config {
  const missing = REQUIRED.filter((name) => !env[name]);
  if (missing.length > 0) throw new Error(`missing environment variables: ${missing.join(', ')}`);

  const rawPort = env.PORT ?? '3000';
  const port = /^\d+$/.test(rawPort) ? Number(rawPort) : NaN;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`PORT must be an integer from 1 to 65535, got ${rawPort}`);
  }

  const rawTrust = env.TRUST_PROXY ?? '0';
  if (!/^\d+$/.test(rawTrust)) {
    throw new Error(`TRUST_PROXY must be a whole number of proxy hops, got ${rawTrust}`);
  }

  // Raised only where every client shares one address, e.g. the CI e2e suite.
  const rawPerIp = env.RATE_LIMIT_PER_IP ?? String(DEFAULT_LIMITS.perIp);
  if (!/^\d+$/.test(rawPerIp) || Number(rawPerIp) < 1) {
    throw new Error(`RATE_LIMIT_PER_IP must be a positive whole number, got ${rawPerIp}`);
  }

  return {
    databaseUrl: env.DATABASE_URL!,
    supabaseUrl: env.SUPABASE_URL!.replace(/\/+$/, ''),
    supabaseServiceKey: env.SUPABASE_SERVICE_KEY!,
    port,
    imageBucket: env.IMAGE_BUCKET || 'vision',
    trustProxy: Number(rawTrust),
    rateLimitPerIp: Number(rawPerIp)
  };
}
