export interface Config {
  databaseUrl: string;
  supabaseUrl: string;
  supabaseServiceKey: string;
  port: number;
  imageBucket: string;
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

  return {
    databaseUrl: env.DATABASE_URL!,
    supabaseUrl: env.SUPABASE_URL!.replace(/\/+$/, ''),
    supabaseServiceKey: env.SUPABASE_SERVICE_KEY!,
    port,
    imageBucket: env.IMAGE_BUCKET || 'vision'
  };
}
