import { createRemoteJWKSet } from 'jose';
import { createApp } from './app';
import { createVerifier } from './auth';
import { loadConfig } from './config';
import { createPool } from './db/pool';
import { createSupabaseImageStore } from './images';

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

const server = createApp({ pool, verify, images }).listen(config.port, () => {
  console.log(`api listening on ${config.port}`);
});

process.on('SIGTERM', () => server.close(() => void pool.end()));
