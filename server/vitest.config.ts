import { defineConfig } from 'vitest/config';
process.env.TZ = 'UTC'; // ported specs assume local dates == UTC dates
export default defineConfig({
  test: {
    globalSetup: ['./test/globalSetup.ts'],
    env: {
      MIGRATE_DATABASE_URL: 'postgres://postgres:postgres@localhost:54329/postgres',
      DATABASE_URL: 'postgres://mushpoint_app:mushpoint_app@localhost:54329/postgres',
      MUSHPOINT_APP_PASSWORD: 'mushpoint_app',
      TZ: 'UTC'
    }
  }
});
