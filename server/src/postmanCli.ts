/** `npm run postman`: writes the Postman collection to `postman/`. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { buildPostman } from './postman';

const dir = new URL('../postman/', import.meta.url);
mkdirSync(dir, { recursive: true });
const out = new URL('mushpoint.postman_collection.json', dir);
writeFileSync(out, `${JSON.stringify(buildPostman(), null, 2)}\n`);
console.log(`wrote ${out.pathname}`);
