import path from 'node:path';
import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

// packages/design is a sibling of this app dir, linked in via the npm
// workspace symlink — Vite's dev server otherwise 403s requests for files
// outside its project root even when they resolve through node_modules.
const workspaceRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	// mushpoint-design ships uncompiled .svelte/.ts source via an npm workspace
	// link (not prebuilt JS), so it must go through svelte-vite-plugin like any
	// app source file rather than being esbuild-prebundled as an opaque dep.
	optimizeDeps: { exclude: ['mushpoint-design'] },
	ssr: { noExternal: ['mushpoint-design'] },
	server: { fs: { allow: [workspaceRoot] } },
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
