/** `npm run openapi`: writes the API description to `openapi.json`. */
import { writeFileSync } from 'node:fs';
import { buildOpenApi } from './openapi';

const out = new URL('../openapi.json', import.meta.url);
writeFileSync(out, `${JSON.stringify(buildOpenApi(), null, 2)}\n`);
console.log(`wrote ${out.pathname}`);
