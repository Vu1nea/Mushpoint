import { createRemoteJWKSet } from 'jose';
import { createApp } from './app';
import { createVerifier } from './auth';
import { createSupabaseAuthAdmin } from './authAdmin';
import { loadConfig } from './config';
import { createPool } from './db/pool';
import { createSupabaseImageStore } from './images';
import { log } from './logger';
import { DEFAULT_LIMITS } from './rateLimit';
import { shutdown } from './shutdown';

const config = loadConfig(process.env);
const pool = createPool(config.databaseUrl);
const verify = createVerifier({
  getKey: createRemoteJWKSet(new URL(`${config.supabaseUrl}/auth/v1/.well-known/jwks.json`)),
  issuer: `${config.supabaseUrl}/auth/v1`,
  audience: 'authenticated'
});
const images = createSupabaseImageStore({
  url: config.supabaseUrl,
  serviceKey: config.supabaseServiceKey,
  bucket: config.imageBucket
});

const authAdmin = createSupabaseAuthAdmin({ url: config.supabaseUrl, serviceKey: config.supabaseServiceKey });

const server = createApp({
  pool,
  verify,
  images,
  authAdmin,
  trustProxy: config.trustProxy,
  limits: { ...DEFAULT_LIMITS, perIp: config.rateLimitPerIp }
}).listen(config.port, () => {
  log.info({ port: config.port }, 'api listening');
});

// Kubernetes sends SIGTERM and allows 30 s by default; finish well inside it.
let stopping = false;
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    if (stopping) return;
    stopping = true;
    log.info({ signal }, 'shutting down');
    void shutdown({ server, pool, logger: log, exit: (code) => process.exit(code), timeoutMs: 20_000 });
  });
}
