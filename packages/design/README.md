# mushpoint-design

Shared design tokens, framework-agnostic utilities, and Svelte 5 UI primitives
extracted from [Mushpoint](https://github.com/Vu1nea/Mush-Track). Single source of
truth for the nocturne/coquette look-and-feel across Mushpoint and its sibling
projects, split by how portable each piece is:

- **`css/`** — Tailwind v4 tokens (`theme.css`), fonts. Plain CSS, works in any
  Tailwind v4 project regardless of framework.
- **`utils/`** — plain TS/JS: class-string builders (`ui.ts`), motion helpers
  (`motion.ts`), date/format helpers (`format.ts`), select/calendar-grid math,
  error normalization. No DOM or framework dependency.
- **`icons/`** — generic icon set (`check`, `close`, `calendar`, etc.) as inline
  SVG markup strings.
- **`svelte/`** — Svelte 5 (runes) UI primitives (`Checkbox`, `Select`,
  `DatePicker`, `Drawer`, `Tooltip`, …) built on the above. **Svelte-only.**

## Using this in a non-Svelte project

Only `css/` and `utils/` are directly importable. `svelte/` components aren't —
treat them as the reference spec (props, ARIA roles, keyboard behavior) and
hand-rebuild the same contract natively in your framework, consuming this
package's `css/` tokens and `utils/` helpers so the result renders identically.

## Install

Not published to npm — install straight from the repo, pinned to a tag or commit:

```sh
npm install git+https://github.com/Vu1nea/mushpoint-design.git#v0.0.1
```

## Import convention

Import by subpath, matching the folder layout, e.g.:

```ts
import { button, chip } from 'mushpoint-design/utils/ui';
import { daysUntil } from 'mushpoint-design/utils/format';
```

```svelte
<script>
	import Checkbox from 'mushpoint-design/svelte/Checkbox.svelte';
</script>
```

```css
@import 'mushpoint-design/css/theme.css';
```

There's deliberately no `"exports"` map in `package.json` — imports mix
extensionless (`utils/ui`) and explicit-extension (`svelte/Checkbox.svelte`)
forms, and a bundler's default bare-specifier resolution handles both by
probing extensions itself. An `exports` map would only handle the exact paths
listed and break the extensionless ones.

## Consuming raw source

This package ships **uncompiled** `.ts`/`.svelte` source, not a build. Your
bundler needs to transform it like first-party source rather than treating it
as an opaque pre-built dependency. With Vite:

```ts
// vite.config.ts
export default defineConfig({
	optimizeDeps: { exclude: ['mushpoint-design'] },
	ssr: { noExternal: ['mushpoint-design'] }
});
```

Svelte consumers also need `svelte: ^5.0.0` (peer dependency) and a Svelte
Vite plugin in their build (`@sveltejs/vite-plugin-svelte` or SvelteKit).
