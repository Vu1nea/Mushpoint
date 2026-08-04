# Vision Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Phase 6 — a masonry board of freeform image/quote cards (`vision_items`), created and manually reordered directly on the board, with no pull-in from Goals or Ideas.

**Architecture:** A new `vision_items` table (migration 5) behind a `db/repo/visionItem.ts` repo module, following the exact shape of `subgoal.ts`. A new `lib/images.ts` adds the app's first filesystem plumbing (via `tauri-plugin-dialog` + `tauri-plugin-fs`) so a picked image gets copied into `<appDataDir>/images/` and rendered through the Tauri asset protocol. Frontend is a presentation-only `VisionBoard.svelte` (native HTML5 drag-and-drop, CSS multi-column masonry) driven by a route that owns drawer/confirm state, mirroring `ideas/+page.svelte`.

**Tech Stack:** TypeScript, SvelteKit, `@tauri-apps/plugin-dialog`, `@tauri-apps/plugin-fs`, `node:sqlite` (tests), vitest.

**Spec:** `docs/superpowers/specs/2026-08-03-vision-board-design.md`

## Global Constraints

- No pull-in from Goals or Ideas — `vision_items` is fully standalone, no FK to `goals`/`categories`.
- A `vision_items` row needs at least one of `image_path`/`quote_text` non-empty; enforced both by a `CHECK` constraint and by repo-layer validation before the insert/update runs.
- Items are always global — no `category_id`/`goal_id` column, no filter UI.
- Ordering is a `position` column, rewritten in full on every reorder (no diffing) — `SqlDriver` has no transaction primitive, so `reorder` is a sequence of awaited single-row `UPDATE`s, matching how every other multi-statement repo function in this codebase already works (no transaction anywhere).
- Picked images are copied into `<appDataDir>/images/<uuid><ext>`; the DB stores that relative path, never the original OS path.
- Masonry layout is CSS multi-column (`columns-*` + `break-inside-avoid`) — no new layout library.
- Drag-and-drop is native HTML5 drag events, structurally mirroring `KanbanBoard.svelte`'s `dragOver`/`dragLeave`/`drop` — no drag library.
- This migration is version 5, file `0005_vision_items.sql`, registered in `lib.rs`'s `migrations()` immediately after version 4. `db_baseline.rs` needs no change — it only ever baselines migrations 1–2 (see its own doc comment).

---

### Task 1: Schema — migration 5

**Files:**
- Create: `app/src-tauri/migrations/0005_vision_items.sql`
- Modify: `app/src-tauri/src/lib.rs`
- Modify: `app/src/lib/db/testSchema.ts`
- Modify: `app/src/lib/db/testSchema.spec.ts`

**Interfaces:**
- Produces: a `vision_items` table (`id, image_path, quote_text, position, created_at, updated_at`) reachable from both the real Tauri driver and `createTestDriver()` in tests.

- [ ] **Step 1: Write the migration file**

```sql
CREATE TABLE vision_items (
    id           INTEGER PRIMARY KEY,
    image_path   TEXT,
    quote_text   TEXT,
    position     INTEGER NOT NULL,
    created_at   TEXT    NOT NULL,
    updated_at   TEXT    NOT NULL,
    CHECK (image_path IS NOT NULL OR quote_text IS NOT NULL)
);
CREATE INDEX idx_vision_items_position ON vision_items(position);
```

Save as `app/src-tauri/migrations/0005_vision_items.sql`.

- [ ] **Step 2: Register migration 5 in `lib.rs`**

In `app/src-tauri/src/lib.rs`, add a fifth entry to the `migrations()` vec, right after the `version: 4` block:

```rust
        Migration {
            version: 5,
            description: "vision_items",
            sql: include_str!("../migrations/0005_vision_items.sql"),
            kind: MigrationKind::Up,
        },
```

- [ ] **Step 3: Mirror the table in `testSchema.ts`**

In `app/src/lib/db/testSchema.ts`, append after the `idea_tag_links` block (before the closing backtick):

```sql

CREATE TABLE vision_items (
    id           INTEGER PRIMARY KEY,
    image_path   TEXT,
    quote_text   TEXT,
    position     INTEGER NOT NULL,
    created_at   TEXT    NOT NULL,
    updated_at   TEXT    NOT NULL,
    CHECK (image_path IS NOT NULL OR quote_text IS NOT NULL)
);
CREATE INDEX idx_vision_items_position ON vision_items(position);
```

Also update the file's top doc comment from "Mirrors ... + 0004_ideas.sql exactly." to "Mirrors ... + 0004_ideas.sql + 0005_vision_items.sql exactly."

- [ ] **Step 4: Update the schema-parity test**

In `app/src/lib/db/testSchema.spec.ts`, add a line after the `0004_ideas.sql` exec so `fromMigrations` also applies migration 5:

```ts
			fromMigrations.exec(readFileSync(join(migrationsDir, '0004_ideas.sql'), 'utf-8'));
			fromMigrations.exec(readFileSync(join(migrationsDir, '0005_vision_items.sql'), 'utf-8'));
```

- [ ] **Step 5: Run the schema-parity test**

Run: `cd app && npx vitest run src/lib/db/testSchema.spec.ts`
Expected: PASS — `TEST_SCHEMA` and the real migrations now describe the same tables/columns, including `vision_items`.

- [ ] **Step 6: Commit**

```bash
git add app/src-tauri/migrations/0005_vision_items.sql app/src-tauri/src/lib.rs app/src/lib/db/testSchema.ts app/src/lib/db/testSchema.spec.ts
git commit -m "$(cat <<'EOF'
feat: add vision_items schema (migration 5)

Phase 6 (Vision Board) storage: standalone image/quote cards, no FK
to goals/categories per the design's scope pivot.
EOF
)"
```

---

### Task 2: API types

**Files:**
- Modify: `app/src/lib/api/types.ts`

**Interfaces:**
- Produces: `VisionItem`, `VisionItemInput` — consumed by Task 3's repo module and every frontend task after it.

- [ ] **Step 1: Add the types**

Append to `app/src/lib/api/types.ts`, after the `IdeaInput` interface:

```ts
export interface VisionItem {
	id: number;
	imagePath: string | null;
	quoteText: string | null;
	position: number;
	createdAt: string;
	updatedAt: string;
}

export interface VisionItemInput {
	imagePath: string | null;
	quoteText: string | null;
}
```

- [ ] **Step 2: Typecheck**

Run: `cd app && npx svelte-check --tsconfig ./tsconfig.json`
Expected: PASS, no new errors.

- [ ] **Step 3: Commit**

```bash
git add app/src/lib/api/types.ts
git commit -m "$(cat <<'EOF'
feat: add VisionItem/VisionItemInput types
EOF
)"
```

---

### Task 3: Repo layer — `visionItem.ts`

**Files:**
- Create: `app/src/lib/db/repo/visionItem.ts`
- Create: `app/src/lib/db/repo/visionItem.spec.ts`

**Interfaces:**
- Consumes: `SqlDriver` (`app/src/lib/db/driver.ts`), `AppError` (`app/src/lib/db/error.ts`), `now`/`optionalText` (`app/src/lib/db/repo/helpers.ts`), `VisionItem`/`VisionItemInput` (Task 2).
- Produces: `list(driver)`, `get(driver, id)`, `create(driver, input)`, `update(driver, id, input)`, `remove(driver, id)`, `reorder(driver, orderedIds: number[])` — all consumed by Task 5's API surface.

- [ ] **Step 1: Write the failing test file**

Create `app/src/lib/db/repo/visionItem.spec.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import type { SqlDriver } from '../driver';
import { createTestDriver } from '../testDriver';
import * as visionItem from './visionItem';

let driver: SqlDriver;

beforeEach(() => {
	driver = createTestDriver();
});

describe('visionItem', () => {
	it('new items append in position order', async () => {
		const first = await visionItem.create(driver, { imagePath: null, quoteText: 'Keep going' });
		const second = await visionItem.create(driver, { imagePath: 'images/a.png', quoteText: null });

		expect([first.position, second.position]).toEqual([0, 1]);
		expect((await visionItem.list(driver)).map((i) => i.id)).toEqual([first.id, second.id]);
	});

	it('accepts image-only, quote-only, or both', async () => {
		const imageOnly = await visionItem.create(driver, { imagePath: 'images/a.png', quoteText: null });
		const quoteOnly = await visionItem.create(driver, { imagePath: null, quoteText: 'Keep going' });
		const both = await visionItem.create(driver, { imagePath: 'images/b.png', quoteText: 'Both' });

		expect(imageOnly.imagePath).toBe('images/a.png');
		expect(quoteOnly.quoteText).toBe('Keep going');
		expect(both.imagePath).toBe('images/b.png');
		expect(both.quoteText).toBe('Both');
	});

	it('rejects an item with neither image nor quote', async () => {
		await expect(
			visionItem.create(driver, { imagePath: null, quoteText: null })
		).rejects.toMatchObject({ kind: 'validation' });
	});

	it('rejects whitespace-only quote text with no image, same as empty', async () => {
		await expect(
			visionItem.create(driver, { imagePath: null, quoteText: '   ' })
		).rejects.toMatchObject({ kind: 'validation' });
	});

	it('update replaces content and re-validates', async () => {
		const created = await visionItem.create(driver, { imagePath: null, quoteText: 'Original' });
		const updated = await visionItem.update(driver, created.id, {
			imagePath: 'images/new.png',
			quoteText: null
		});

		expect(updated.imagePath).toBe('images/new.png');
		expect(updated.quoteText).toBeNull();

		await expect(
			visionItem.update(driver, created.id, { imagePath: null, quoteText: null })
		).rejects.toMatchObject({ kind: 'validation' });
	});

	it('rejects updating a missing item', async () => {
		await expect(
			visionItem.update(driver, 404, { imagePath: null, quoteText: 'x' })
		).rejects.toMatchObject({ kind: 'not_found' });
	});

	it('remove deletes the row', async () => {
		const created = await visionItem.create(driver, { imagePath: null, quoteText: 'Bye' });
		await visionItem.remove(driver, created.id);

		await expect(visionItem.get(driver, created.id)).rejects.toMatchObject({ kind: 'not_found' });
	});

	it('rejects removing a missing item', async () => {
		await expect(visionItem.remove(driver, 404)).rejects.toMatchObject({ kind: 'not_found' });
	});

	it('reorder rewrites positions to match the given id order', async () => {
		const first = await visionItem.create(driver, { imagePath: null, quoteText: 'First' });
		const second = await visionItem.create(driver, { imagePath: null, quoteText: 'Second' });
		const third = await visionItem.create(driver, { imagePath: null, quoteText: 'Third' });

		await visionItem.reorder(driver, [third.id, first.id, second.id]);

		const ordered = await visionItem.list(driver);
		expect(ordered.map((i) => i.id)).toEqual([third.id, first.id, second.id]);
		expect(ordered.map((i) => i.position)).toEqual([0, 1, 2]);
	});
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd app && npx vitest run src/lib/db/repo/visionItem.spec.ts`
Expected: FAIL — `Cannot find module './visionItem'` (the module doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `app/src/lib/db/repo/visionItem.ts`:

```ts
import type { SqlDriver } from '../driver';
import { AppError } from '../error';
import type { VisionItem, VisionItemInput } from '../../api/types';
import { now, optionalText } from './helpers';

const COLUMNS = 'id, image_path, quote_text, position, created_at, updated_at';
const ORDER = 'ORDER BY position, id';

interface VisionItemRow {
	id: number;
	image_path: string | null;
	quote_text: string | null;
	position: number;
	created_at: string;
	updated_at: string;
}

function map(row: VisionItemRow): VisionItem {
	return {
		id: row.id,
		imagePath: row.image_path,
		quoteText: row.quote_text,
		position: row.position,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

/** Neither field is individually required, but at least one must carry
 * content — an empty card has nothing to show on the board. Validated here
 * (not just left to the table's CHECK constraint) so the failure is a
 * friendly AppError instead of a raw SQLite error. */
function requireContent(input: VisionItemInput): {
	imagePath: string | null;
	quoteText: string | null;
} {
	const imagePath = optionalText(input.imagePath);
	const quoteText = optionalText(input.quoteText);
	if (!imagePath && !quoteText) {
		throw AppError.validation('a vision item needs an image, a quote, or both');
	}
	return { imagePath, quoteText };
}

export async function list(driver: SqlDriver): Promise<VisionItem[]> {
	const rows = await driver.select<VisionItemRow>(`SELECT ${COLUMNS} FROM vision_items ${ORDER}`);
	return rows.map(map);
}

export async function get(driver: SqlDriver, id: number): Promise<VisionItem> {
	const rows = await driver.select<VisionItemRow>(
		`SELECT ${COLUMNS} FROM vision_items WHERE id = ?1`,
		[id]
	);
	const row = rows[0];
	if (!row) throw AppError.notFound('vision item', id);
	return map(row);
}

export async function create(driver: SqlDriver, input: VisionItemInput): Promise<VisionItem> {
	const { imagePath, quoteText } = requireContent(input);
	const nextPosition = await driver.select<{ next: number }>(
		'SELECT COALESCE(MAX(position) + 1, 0) as next FROM vision_items'
	);
	const timestamp = now();

	const result = await driver.execute(
		`INSERT INTO vision_items (image_path, quote_text, position, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?4)`,
		[imagePath, quoteText, nextPosition[0].next, timestamp]
	);

	return get(driver, result.lastInsertId);
}

export async function update(
	driver: SqlDriver,
	id: number,
	input: VisionItemInput
): Promise<VisionItem> {
	const { imagePath, quoteText } = requireContent(input);
	const result = await driver.execute(
		'UPDATE vision_items SET image_path = ?1, quote_text = ?2, updated_at = ?3 WHERE id = ?4',
		[imagePath, quoteText, now(), id]
	);
	if (result.rowsAffected === 0) throw AppError.notFound('vision item', id);
	return get(driver, id);
}

export async function remove(driver: SqlDriver, id: number): Promise<void> {
	const result = await driver.execute('DELETE FROM vision_items WHERE id = ?1', [id]);
	if (result.rowsAffected === 0) throw AppError.notFound('vision item', id);
}

/** Rewrites position for every id in the given order — the full board
 * order, not a delta, mirroring how `idea.update` replaces tag links
 * wholesale rather than diffing. `SqlDriver` has no transaction primitive
 * (true of every other multi-statement repo function here too), so this is
 * a sequence of awaited single-row updates rather than one atomic batch. */
export async function reorder(driver: SqlDriver, orderedIds: number[]): Promise<void> {
	for (let position = 0; position < orderedIds.length; position++) {
		await driver.execute('UPDATE vision_items SET position = ?1 WHERE id = ?2', [
			position,
			orderedIds[position]
		]);
	}
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd app && npx vitest run src/lib/db/repo/visionItem.spec.ts`
Expected: PASS, all 8 cases.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/db/repo/visionItem.ts app/src/lib/db/repo/visionItem.spec.ts
git commit -m "$(cat <<'EOF'
feat: add visionItem repo layer

CRUD + reorder for vision_items, TDD'd against node:sqlite same as
every other repo module.
EOF
)"
```

---

### Task 4: Image plumbing

**Files:**
- Modify: `app/src-tauri/Cargo.toml`
- Modify: `app/src-tauri/src/lib.rs`
- Modify: `app/src-tauri/capabilities/default.json`
- Modify: `app/src-tauri/tauri.conf.json`
- Modify: `app/package.json`
- Create: `app/src/lib/images.ts`
- Create: `app/src/lib/images.spec.ts`
- Create: `app/src/lib/components/VisionImage.svelte`

**Interfaces:**
- Produces: `pickAndCopyImage(): Promise<string | null>`, `deleteImage(relativePath: string): Promise<void>`, `extensionOf(path: string): string` (all `app/src/lib/images.ts`) — consumed by Task 5 (`deleteImage`) and Task 6 (`pickAndCopyImage`). `VisionImage.svelte` (props: `path: string`, `alt?: string`, `class?: string`) — consumed by Tasks 6 and 7.
- Nothing in this task is wired into any route yet; the dialog/fs round trip is exercised for real in Task 8's manual verification, not here.

- [ ] **Step 1: Add the Rust plugin dependencies**

Run: `cd app/src-tauri && cargo add tauri-plugin-dialog && cargo add tauri-plugin-fs`

This appends `tauri-plugin-dialog` and `tauri-plugin-fs` lines to `Cargo.toml` — don't hand-type versions.

- [ ] **Step 2: Add the JS plugin dependencies**

Run: `cd app && npm install @tauri-apps/plugin-dialog @tauri-apps/plugin-fs`

- [ ] **Step 3: Register both plugins in `lib.rs`**

In `app/src-tauri/src/lib.rs`, add two lines to the plugin chain in `run()`, after `.plugin(tauri_plugin_opener::init())`:

```rust
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
```

- [ ] **Step 4: Grant dialog + scoped fs permissions**

In `app/src-tauri/capabilities/default.json`, add to the `permissions` array (after `"opener:allow-default-urls"`):

```json
		"dialog:allow-open",
		{
			"identifier": "fs:allow-mkdir",
			"allow": [{ "path": "$APPDATA/images" }]
		},
		{
			"identifier": "fs:allow-copy-file",
			"allow": [{ "path": "$APPDATA/images/**" }]
		},
		{
			"identifier": "fs:allow-exists",
			"allow": [{ "path": "$APPDATA/images/**" }]
		},
		{
			"identifier": "fs:allow-remove",
			"allow": [{ "path": "$APPDATA/images/**" }]
		}
```

- [ ] **Step 5: Enable the asset protocol for the images folder**

In `app/src-tauri/tauri.conf.json`, change `app.security` from:

```json
			"security": {
				"csp": null
			}
```

to:

```json
			"security": {
				"csp": null,
				"assetProtocol": {
					"enable": true,
					"scope": ["$APPDATA/images/*"]
				}
			}
```

This is what lets `convertFileSrc()` resolve a copied image to a loadable `<img src>` URL.

- [ ] **Step 6: Write the failing test for the one pure helper**

Create `app/src/lib/images.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { extensionOf } from './images';

describe('extensionOf', () => {
	it('extracts the extension including the dot', () => {
		expect(extensionOf('/Users/vinod/Pictures/sunset.png')).toBe('.png');
		expect(extensionOf('C:\\Users\\vinod\\Pictures\\sunset.JPEG')).toBe('.JPEG');
	});

	it('returns an empty string for a path with no extension', () => {
		expect(extensionOf('/Users/vinod/Pictures/sunset')).toBe('');
	});
});
```

- [ ] **Step 7: Run it to verify it fails**

Run: `cd app && npx vitest run src/lib/images.spec.ts`
Expected: FAIL — `Cannot find module './images'`.

- [ ] **Step 8: Write `images.ts`**

Create `app/src/lib/images.ts`:

```ts
import { copyFile, exists, mkdir, remove, BaseDirectory } from '@tauri-apps/plugin-fs';
import { open } from '@tauri-apps/plugin-dialog';
import { appDataDir, join } from '@tauri-apps/api/path';
import { convertFileSrc } from '@tauri-apps/api/core';

const IMAGES_DIR = 'images';
const EXTENSION_PATTERN = /\.[^./\\]+$/;

/** Pure — extracts the extension (with dot) from a path, defaulting to an
 * empty string when the source has none. Exported for testing; every other
 * function here calls into Tauri plugins and only runs inside the app. */
export function extensionOf(path: string): string {
	const match = EXTENSION_PATTERN.exec(path);
	return match ? match[0] : '';
}

/** Opens the native file picker filtered to images and copies the chosen
 * file into `<appDataDir>/images/<uuid><ext>`. Returns the relative path
 * (`images/<uuid><ext>`) to store as `VisionItem.imagePath`, or null if the
 * user cancels. The copy happens immediately on pick rather than deferred
 * to the caller's save — see `VisionItemDrawer.svelte` for the accepted
 * trade-off (a picked-then-cancelled replacement leaves one unused file on
 * disk; harmless clutter, not a correctness issue). */
export async function pickAndCopyImage(): Promise<string | null> {
	const selected = await open({
		multiple: false,
		filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }]
	});
	if (!selected || Array.isArray(selected)) return null;

	await mkdir(IMAGES_DIR, { baseDir: BaseDirectory.AppData, recursive: true });
	const relativePath = `${IMAGES_DIR}/${crypto.randomUUID()}${extensionOf(selected)}`;
	await copyFile(selected, relativePath, { toPathBaseDir: BaseDirectory.AppData });
	return relativePath;
}

/** Deletes a previously-copied image. Checks existence first so deleting an
 * already-missing file is a silent no-op rather than an error the caller
 * has to handle. */
export async function deleteImage(relativePath: string): Promise<void> {
	const isPresent = await exists(relativePath, { baseDir: BaseDirectory.AppData });
	if (isPresent) await remove(relativePath, { baseDir: BaseDirectory.AppData });
}

/** Resolves a stored relative path to a URL an `<img>` tag can load. */
export async function resolveImageSrc(relativePath: string): Promise<string> {
	const full = await join(await appDataDir(), relativePath);
	return convertFileSrc(full);
}
```

- [ ] **Step 9: Run the test to verify it passes**

Run: `cd app && npx vitest run src/lib/images.spec.ts`
Expected: PASS.

- [ ] **Step 10: Write `VisionImage.svelte`**

Create `app/src/lib/components/VisionImage.svelte`:

```svelte
<!-- app/src/lib/components/VisionImage.svelte -->
<script lang="ts">
	import { resolveImageSrc } from '$lib/images';

	interface Props {
		/** A relative path as stored on a VisionItem, e.g. `images/<uuid>.png`. */
		path: string;
		alt?: string;
		class?: string;
	}

	let { path, alt = '', class: className = '' }: Props = $props();

	let src = $state<string | null>(null);

	$effect(() => {
		src = null;
		resolveImageSrc(path).then((resolved) => {
			src = resolved;
		});
	});
</script>

{#if src}
	<img {src} {alt} class={className} />
{/if}
```

- [ ] **Step 11: Typecheck**

Run: `cd app && npx svelte-check --tsconfig ./tsconfig.json`
Expected: PASS.

- [ ] **Step 12: Commit**

```bash
git add app/src-tauri/Cargo.toml app/src-tauri/Cargo.lock app/src-tauri/src/lib.rs app/src-tauri/capabilities/default.json app/src-tauri/tauri.conf.json app/package.json app/package-lock.json app/src/lib/images.ts app/src/lib/images.spec.ts app/src/lib/components/VisionImage.svelte
git commit -m "$(cat <<'EOF'
feat: add image picker/copy plumbing (dialog + fs plugins)

First filesystem access in the app: pick via native dialog, copy into
appDataDir/images, render through the scoped asset protocol.
EOF
)"
```

---

### Task 5: API surface

**Files:**
- Modify: `app/src/lib/api/index.ts`

**Interfaces:**
- Consumes: `visionItem.ts` (Task 3), `deleteImage` from `images.ts` (Task 4).
- Produces: `listVisionItems()`, `createVisionItem(input)`, `updateVisionItem(id, input)`, `deleteVisionItem(id)`, `reorderVisionItems(orderedIds)` — consumed by Tasks 6–8.

- [ ] **Step 1: Wire the exports**

In `app/src/lib/api/index.ts`, add an import alongside the existing repo imports:

```ts
import * as visionItemRepo from '../db/repo/visionItem';
```

And import `deleteImage` alongside the other top-of-file imports:

```ts
import { deleteImage } from '../images';
```

Then append, after the `listIdeaTags` export at the end of the file:

```ts

export const listVisionItems = async (): Promise<VisionItem[]> =>
	visionItemRepo.list(await getDriver());
export const createVisionItem = async (input: VisionItemInput): Promise<VisionItem> =>
	visionItemRepo.create(await getDriver(), input);
/** Updates the DB row first, then best-effort deletes the old image file if
 * it was replaced or removed — in that order so a failed file delete never
 * leaves a live record pointing at nothing, at the cost of occasionally
 * leaking a now-unreferenced file on disk. */
export const updateVisionItem = async (id: number, input: VisionItemInput): Promise<VisionItem> => {
	const driver = await getDriver();
	const existing = await visionItemRepo.get(driver, id);
	const saved = await visionItemRepo.update(driver, id, input);
	if (existing.imagePath && existing.imagePath !== input.imagePath) {
		await deleteImage(existing.imagePath);
	}
	return saved;
};
/** Deletes the backing image file before the row, so a failed file delete
 * leaves the record intact (and thus retryable) rather than orphaning a
 * file with no row left to reference it. */
export const deleteVisionItem = async (id: number): Promise<void> => {
	const driver = await getDriver();
	const item = await visionItemRepo.get(driver, id);
	if (item.imagePath) await deleteImage(item.imagePath);
	await visionItemRepo.remove(driver, id);
};
export const reorderVisionItems = async (orderedIds: number[]): Promise<void> =>
	visionItemRepo.reorder(await getDriver(), orderedIds);
```

Also add `VisionItem` and `VisionItemInput` to the `import type { ... } from './types'` block at the top of the file (the existing multi-line type import list) — they're already re-exported by the file's `export * from './types'` line, this addition is only so the two new functions above can reference the types directly.

- [ ] **Step 2: Typecheck**

Run: `cd app && npx svelte-check --tsconfig ./tsconfig.json`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/src/lib/api/index.ts
git commit -m "$(cat <<'EOF'
feat: expose vision item CRUD + reorder through the API surface
EOF
)"
```

---

### Task 6: `VisionItemDrawer.svelte`

**Files:**
- Create: `app/src/lib/components/VisionItemDrawer.svelte`

**Interfaces:**
- Consumes: `createVisionItem`/`updateVisionItem` (Task 5), `pickAndCopyImage` (Task 4), `VisionImage.svelte` (Task 4), `Drawer.svelte`, `Icon.svelte`, `button`/`field` (`./ui`).
- Produces: `<VisionItemDrawer open item onClose onSaved />` — consumed by Task 8's route.

- [ ] **Step 1: Write the component**

Create `app/src/lib/components/VisionItemDrawer.svelte`:

```svelte
<!-- app/src/lib/components/VisionItemDrawer.svelte -->
<script lang="ts">
	import { createVisionItem, updateVisionItem, type VisionItem } from '$lib/api';
	import { pickAndCopyImage } from '$lib/images';
	import Drawer from './Drawer.svelte';
	import Icon from './Icon.svelte';
	import VisionImage from './VisionImage.svelte';
	import { button, field } from './ui';

	interface Props {
		open: boolean;
		/** Null creates an item; an item edits it in place. */
		item?: VisionItem | null;
		onClose: () => void;
		onSaved: () => Promise<void> | void;
	}

	let { open, item = null, onClose, onSaved }: Props = $props();

	let submitting = $state(false);
	let picking = $state(false);
	let error = $state<unknown>(null);
	let contentMissing = $state(false);
	let shake = $state(false);

	let form = $state({ imagePath: null as string | null, quoteText: '' });

	// Each opening starts from the record being edited, or from a blank item.
	$effect(() => {
		if (!open) return;
		error = null;
		contentMissing = false;
		form = {
			imagePath: item?.imagePath ?? null,
			quoteText: item?.quoteText ?? ''
		};
	});

	async function pickImage() {
		picking = true;
		try {
			const picked = await pickAndCopyImage();
			if (picked) {
				form.imagePath = picked;
				contentMissing = false;
			}
		} catch (failure) {
			error = failure;
		} finally {
			picking = false;
		}
	}

	async function submit() {
		const quoteText = form.quoteText.trim();
		if (!form.imagePath && !quoteText) {
			contentMissing = true;
			shake = true;
			return;
		}

		submitting = true;
		error = null;
		const input = { imagePath: form.imagePath, quoteText: quoteText || null };

		try {
			await (item ? updateVisionItem(item.id, input) : createVisionItem(input));
			await onSaved();
			onClose();
		} catch (failure) {
			error = failure;
		} finally {
			submitting = false;
		}
	}
</script>

<Drawer
	{open}
	title={item ? 'Edit Vision Item' : 'New Vision Item'}
	submitLabel={item ? 'Save' : 'Create'}
	{submitting}
	{error}
	{onClose}
	onSubmit={submit}
>
	<div>
		<span class={field.label}>Image (optional)</span>
		{#if form.imagePath}
			<div class="mb-2 overflow-hidden rounded-control border border-subtle">
				<VisionImage path={form.imagePath} class="h-40 w-full object-cover" />
			</div>
		{/if}
		<div class="flex gap-2">
			<button type="button" class={button.ghost} disabled={picking} onclick={pickImage}>
				{#if picking}
					<Icon name="spinner" size={14} weight={2.5} class="mp-spin" />
				{/if}
				{form.imagePath ? 'Replace image' : 'Choose image…'}
			</button>
			{#if form.imagePath}
				<button type="button" class={button.ghost} onclick={() => (form.imagePath = null)}>
					Remove image
				</button>
			{/if}
		</div>
	</div>

	<div>
		<label class={field.label} for="vision-quote">Quote (optional)</label>
		<textarea
			id="vision-quote"
			class="{field.input} resize-y {shake ? 'mp-shake' : ''}"
			rows="3"
			bind:value={form.quoteText}
			oninput={() => (contentMissing = false)}
			onanimationend={() => (shake = false)}
			placeholder="A line worth seeing every day…"
		></textarea>
	</div>

	{#if contentMissing}
		<p class="flex items-center gap-1.5 text-xs text-warn">
			<Icon name="warning" size={13} weight={2} /> Add an image, a quote, or both
		</p>
	{/if}
</Drawer>
```

- [ ] **Step 2: Typecheck**

Run: `cd app && npx svelte-check --tsconfig ./tsconfig.json`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/src/lib/components/VisionItemDrawer.svelte
git commit -m "$(cat <<'EOF'
feat: add VisionItemDrawer for creating/editing vision items
EOF
)"
```

---

### Task 7: `VisionBoard.svelte`

**Files:**
- Create: `app/src/lib/components/VisionBoard.svelte`

**Interfaces:**
- Consumes: `VisionItem` (`$lib/api`), `stagger` (`$lib/motion`), `VisionImage.svelte` (Task 4), `Icon.svelte`, `button` (`./ui`).
- Produces: `<VisionBoard items busy onReorder onEdit onDelete onAddNew />` — presentation-only, consumed by Task 8's route. Same ownership split as `KanbanBoard.svelte`: the board renders and emits intent, the route owns drawer/confirm/busy state.

- [ ] **Step 1: Write the component**

Create `app/src/lib/components/VisionBoard.svelte`:

```svelte
<!-- app/src/lib/components/VisionBoard.svelte -->
<script lang="ts">
	import type { VisionItem } from '$lib/api';
	import { stagger } from '$lib/motion';
	import Icon from './Icon.svelte';
	import VisionImage from './VisionImage.svelte';
	import { button } from './ui';

	interface Props {
		items: VisionItem[];
		busy: boolean;
		onReorder: (orderedIds: number[]) => Promise<void> | void;
		onEdit: (item: VisionItem) => void;
		onDelete: (item: VisionItem) => void;
		onAddNew: () => void;
	}

	let { items, busy, onReorder, onEdit, onDelete, onAddNew }: Props = $props();

	let dragId = $state<number | null>(null);
	let dragOverId = $state<number | null>(null);

	function dragStart(event: DragEvent, item: VisionItem) {
		dragId = item.id;
		event.dataTransfer?.setData('text/plain', String(item.id));
	}

	function dragOver(event: DragEvent, item: VisionItem) {
		event.preventDefault();
		if (item.id !== dragId) dragOverId = item.id;
	}

	function dragLeave(item: VisionItem) {
		if (dragOverId === item.id) dragOverId = null;
	}

	function drop(event: DragEvent, target: VisionItem) {
		event.preventDefault();
		dragOverId = null;
		const sourceId = Number(event.dataTransfer?.getData('text/plain'));
		dragId = null;
		if (busy || !sourceId || sourceId === target.id) return;

		const source = items.find((i) => i.id === sourceId);
		if (!source) return;

		const withoutSource = items.filter((i) => i.id !== sourceId);
		const targetIndex = withoutSource.findIndex((i) => i.id === target.id);
		withoutSource.splice(targetIndex, 0, source);

		onReorder(withoutSource.map((i) => i.id));
	}
</script>

{#if items.length === 0}
	<div
		class="flex flex-col items-center gap-3 rounded-card border border-dashed border-subtle py-16"
	>
		<p class="text-sm text-muted">No vision items yet — add an image or a quote to get started.</p>
		<button type="button" class={button.primary} onclick={onAddNew}>
			<Icon name="plus" size={15} weight={2.4} />
			Add to Vision Board
		</button>
	</div>
{:else}
	<div class="columns-1 gap-4 sm:columns-2 lg:columns-3">
		<button
			type="button"
			class="mb-4 flex h-32 w-full items-center justify-center rounded-card border border-dashed border-subtle text-muted transition-colors hover:border-accent/60 hover:text-content"
			onclick={onAddNew}
		>
			<Icon name="plus" size={20} weight={2} label="Add to Vision Board" />
		</button>

		{#each items as item, index (item.id)}
			<div
				class="group mb-4 break-inside-avoid rounded-card border p-3 transition-colors {dragOverId ===
				item.id
					? 'border-accent bg-accent/5'
					: 'border-subtle bg-surface'}"
				style="--mp-delay:{stagger(index, 30)}"
				draggable={!busy}
				ondragstart={(event) => dragStart(event, item)}
				ondragover={(event) => dragOver(event, item)}
				ondragleave={() => dragLeave(item)}
				ondrop={(event) => drop(event, item)}
			>
				{#if item.imagePath}
					<VisionImage path={item.imagePath} class="mb-2 w-full rounded-control object-cover" />
				{/if}
				{#if item.quoteText}
					<p class="text-sm leading-relaxed text-content">{item.quoteText}</p>
				{/if}

				<div
					class="mt-2 flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
				>
					<button type="button" class={button.bare} onclick={() => onEdit(item)}>
						<Icon name="edit" size={13} label="Edit vision item" />
					</button>
					<button type="button" class={button.bare} disabled={busy} onclick={() => onDelete(item)}>
						<Icon name="trash" size={13} label="Delete vision item" />
					</button>
				</div>
			</div>
		{/each}
	</div>
{/if}
```

- [ ] **Step 2: Typecheck**

Run: `cd app && npx svelte-check --tsconfig ./tsconfig.json`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/src/lib/components/VisionBoard.svelte
git commit -m "$(cat <<'EOF'
feat: add VisionBoard masonry grid with drag-to-reorder
EOF
)"
```

---

### Task 8: Route + nav

**Files:**
- Create: `app/src/routes/vision-board/+page.ts`
- Create: `app/src/routes/vision-board/+page.svelte`
- Modify: `app/src/routes/+layout.svelte`

**Interfaces:**
- Consumes: `listVisionItems`, `deleteVisionItem`, `reorderVisionItems` (Task 5), `VisionBoard.svelte` (Task 7), `VisionItemDrawer.svelte` (Task 6), `ConfirmDialog.svelte`, `ErrorBanner.svelte`.
- Produces: the `/vision-board` route, reachable from the sidebar.

- [ ] **Step 1: Write the loader**

Create `app/src/routes/vision-board/+page.ts`:

```ts
import { listVisionItems } from '$lib/api';

export const load = async () => {
	try {
		const items = await listVisionItems();
		return { items, error: null };
	} catch (error) {
		// Shown in place, so the page and its navigation stay usable.
		return { items: [], error };
	}
};
```

- [ ] **Step 2: Write the page**

Create `app/src/routes/vision-board/+page.svelte`:

```svelte
<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { deleteVisionItem, reorderVisionItems, type VisionItem } from '$lib/api';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import ErrorBanner from '$lib/components/ErrorBanner.svelte';
	import VisionBoard from '$lib/components/VisionBoard.svelte';
	import VisionItemDrawer from '$lib/components/VisionItemDrawer.svelte';

	let { data } = $props();

	let busy = $state(false);
	let actionError = $state<unknown>(null);

	let drawerOpen = $state(false);
	let editingItem = $state<VisionItem | null>(null);
	let deletingItem = $state<VisionItem | null>(null);

	async function run(action: () => Promise<unknown>) {
		busy = true;
		actionError = null;
		try {
			await action();
			await invalidateAll();
		} catch (error) {
			actionError = error;
		} finally {
			busy = false;
		}
	}

	function addNew() {
		editingItem = null;
		drawerOpen = true;
	}

	function edit(item: VisionItem) {
		editingItem = item;
		drawerOpen = true;
	}

	async function removeItem() {
		const item = deletingItem;
		if (!item) return;
		deletingItem = null;
		await run(() => deleteVisionItem(item.id));
	}

	function reorder(orderedIds: number[]) {
		return run(() => reorderVisionItems(orderedIds));
	}
</script>

<svelte:head><title>Vision Board · Mushpoint</title></svelte:head>

<header class="mb-6">
	<h1 class="mb-1 font-display text-3xl font-bold">Vision Board</h1>
	<p class="text-sm text-muted">Images and quotes worth seeing every day</p>
</header>

{#if data.error}
	<div class="mb-6"><ErrorBanner error={data.error} /></div>
{/if}
{#if actionError}
	<div class="mb-6"><ErrorBanner error={actionError} onDismiss={() => (actionError = null)} /></div>
{/if}

<VisionBoard
	items={data.items}
	{busy}
	onReorder={reorder}
	onEdit={edit}
	onDelete={(item) => (deletingItem = item)}
	onAddNew={addNew}
/>

<VisionItemDrawer
	open={drawerOpen}
	item={editingItem}
	onClose={() => (drawerOpen = false)}
	onSaved={invalidateAll}
/>

<ConfirmDialog
	open={deletingItem !== null}
	title="Delete this vision item?"
	body="This cannot be undone."
	{busy}
	onConfirm={removeItem}
	onCancel={() => (deletingItem = null)}
/>
```

- [ ] **Step 3: Add the nav entry**

In `app/src/routes/+layout.svelte`, add to the `NAV` array (after the `ideas` entry, before `settings`):

```ts
		{ href: '/vision-board', label: 'Vision Board', icon: 'vision' },
```

And replace the doc comment above `NAV` (currently mentioning Dashboard, Project Manager and Vision Board as not-yet-shipped) with:

```ts
	/**
	 * Sidebar entries for the screens that exist. Dashboard (phase 7) is added
	 * here once it ships. There is no separate Project Manager screen — see
	 * the Architectural Pivot note in `docs/plans/goal_tracker_plan.md`.
	 */
```

- [ ] **Step 4: Typecheck**

Run: `cd app && npx svelte-check --tsconfig ./tsconfig.json`
Expected: PASS.

- [ ] **Step 5: Manual verification**

Run: `cd app && npm run tauri dev`

Walk through, in the running app:
1. Click "Vision Board" in the sidebar — empty state shows with an "Add to Vision Board" button.
2. Click it, click "Choose image…" in the drawer, pick a real image file — a preview appears in the drawer.
3. Add quote text too, save — the card appears on the board showing both the image and the quote.
4. Add a second, quote-only card.
5. Drag one card onto the other — order changes and persists after a page reload (`Cmd/Ctrl+R` or navigate away and back).
6. Edit a card: replace its image, save — new image shows, old file no longer referenced.
7. Edit a card and click "Remove image", save — card now shows quote only.
8. Delete a card via the trash icon and the confirm dialog — it disappears from the board.

If step 2 or 3 fails with a Tauri permission/scope error in the terminal or webview console, the error names the exact missing capability identifier or asset-protocol scope — add that identifier to `capabilities/default.json` (or broaden the `scope` in `tauri.conf.json`'s `assetProtocol`) and retry. This is the only step in the plan that exercises the dialog/fs/asset-protocol wiring for real, since none of it is reachable from `node:sqlite`-backed unit tests.

- [ ] **Step 6: Commit**

```bash
git add app/src/routes/vision-board app/src/routes/+layout.svelte
git commit -m "$(cat <<'EOF'
feat: wire up the Vision Board route and sidebar entry

Closes out Phase 6 of the goal tracker plan.
EOF
)"
```
