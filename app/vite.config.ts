import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	// mushpoint-design ships uncompiled .svelte/.ts source (a git dependency,
	// not a registry build), so it must go through svelte-vite-plugin like any
	// app source file rather than being esbuild-prebundled as an opaque dep.
	optimizeDeps: { exclude: ['mushpoint-design'] },
	ssr: { noExternal: ['mushpoint-design'] },
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
