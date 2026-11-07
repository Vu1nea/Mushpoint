import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('matches the web client API types byte for byte', () => {
  const server = readFileSync(new URL('./types.ts', import.meta.url), 'utf8');
  const web = readFileSync(new URL('../../app/src/lib/api/types.ts', import.meta.url), 'utf8');
  expect(server).toBe(web);
});
