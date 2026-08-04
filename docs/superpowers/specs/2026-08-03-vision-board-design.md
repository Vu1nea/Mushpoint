# Phase 6 — Vision Board

**Status:** approved 2026-08-03
**Plan reference:** `plans/goal_tracker_plan.md` §5 Feature Breakdown / §5 Build Order, Phase 6
**Depends on:** none beyond the base schema (no FK to `goals` or `categories`).

## Goal

A masonry board of freeform inspiration cards (image and/or quote text), added directly on the
board. **Scope pivot from the original plan doc:** v1 does not auto-pull motivation
text/images from Goals, and does not surface Ideas. Vision Board is a standalone island —
Goals/Ideas integration is explicitly deferred past v1.

## Decisions

| Question | Decision |
|---|---|
| Pull cards from Goals/Ideas? | No. v1 is 100% standalone `vision_items`, created only on the board itself. |
| Card content? | At least one of image / quote text set, not both empty. Supports image-only, quote-only, or both. |
| Linked to a Category or Goal (for filtering)? | No. Items are always global; no filter UI in v1. |
| Ordering? | Manual drag-to-reorder via a `position` column, same shape as `subgoals.position`. |
| Image storage? | Picked file is copied into `<appDataDir>/images/`; DB stores the relative path, not the original OS path. |
| Layout technique? | CSS multi-column masonry (`columns-*` + `break-inside-avoid`) — no new layout library. |
| Drag-and-drop technique? | Native HTML5 drag events, same `dragover`/`dragleave`/`drop` pattern `KanbanBoard.svelte` already uses — no drag library. |

## 1. Schema — migration 5

```sql
CREATE TABLE vision_items (
    id           INTEGER PRIMARY KEY,
    image_path   TEXT,
    quote_text   TEXT,
    position     INTEGER NOT NULL,
    created_at   TEXT    NOT NULL,
    updated_at   TEXT    NOT NULL
);
CREATE INDEX idx_vision_items_position ON vision_items(position);
```

Appended as `app/src-tauri/migrations/0005_vision_items.sql`, entry 5 in the migration set (after
`0004_ideas.sql`), registered in `lib.rs`'s `migrations()` vec as `version: 5`.

SQLite has no clean way to express "at least one of two nullable text columns is non-null" as a
column constraint here without a `CHECK` referencing both columns — that's supported
(`CHECK (image_path IS NOT NULL OR quote_text IS NOT NULL)`) and is added to the table
definition, matching the belt-and-suspenders style of other tables (`idea_tags.name UNIQUE
COLLATE NOCASE` also does validation-adjacent work at the schema level). The repo layer still
validates first and throws a friendly `AppError` before ever reaching the DB.

## 2. Image plumbing — new for this phase

Nothing in the app touches the filesystem yet; `goals.motivation_image_path` exists as a column
but has no picker UI. This phase adds that plumbing:

- **Rust:** add `tauri-plugin-dialog` and `tauri-plugin-fs` to `Cargo.toml`, register both in
  `lib.rs` alongside the existing `tauri-plugin-sql`/`tauri-plugin-opener`.
- **JS:** add `@tauri-apps/plugin-dialog` and `@tauri-apps/plugin-fs` to `package.json`.
- **Capabilities:** `capabilities/default.json` gains dialog-open permission and fs read/write/copy
  permission scoped to the app data dir's `images` subfolder — not a general filesystem grant.
- **Flow:** `pickAndCopyImage()` in a new `app/src/lib/images.ts` — opens the native file dialog
  filtered to image extensions, copies the chosen file into `<appDataDir>/images/<uuid>.<ext>`
  (uuid avoids filename collisions between two images picked with the same original name), and
  returns the relative path (`images/<uuid>.<ext>`) to store in `image_path`. A sibling
  `deleteImage(path)` removes the file, called when a card's image is replaced or the card is
  deleted.
- **Rendering:** `<img src={convertFileSrc(fullPath)}>` — `fullPath` is `appDataDir + image_path`,
  resolved once at render time via `@tauri-apps/api/path`'s `appDataDir()`.

## 3. API types — `app/src/lib/api/types.ts`

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

## 4. Repo layer — `app/src/lib/db/repo/visionItem.ts`

Mirrors `subgoal.ts`'s position handling.

- `list(driver): Promise<VisionItem[]>` — `ORDER BY position`.
- `get(driver, id): Promise<VisionItem>` — `AppError.notFound('vision item', id)` if missing.
- `create(driver, input: VisionItemInput): Promise<VisionItem>` — validates
  `imagePath || quoteText` (throws `AppError.validation(...)` if both are null/empty, mirroring
  `requiredText`'s use of `AppError.validation` elsewhere), inserts at `position = max(position) + 1` (`0` if
  the table is empty), same pattern `subgoal.create` already uses.
- `update(driver, id, input: VisionItemInput): Promise<VisionItem>` — same validation, updates
  `image_path`/`quote_text`/`updated_at` only; position unaffected.
- `remove(driver, id): Promise<void>` — deletes the row. Caller (API layer) deletes the backing
  image file first if `image_path` was set, so a failed file delete doesn't orphan-then-retry
  against a row that's already gone.
- `reorder(driver, orderedIds: number[]): Promise<void>` — rewrites `position` for every id in
  the given order, one transaction, same shape as how Kanban drag-and-drop writes task status.

## 5. API surface — `app/src/lib/api/index.ts`

```ts
export const listVisionItems = async (): Promise<VisionItem[]> =>
	visionItemRepo.list(await getDriver());
export const createVisionItem = async (input: VisionItemInput): Promise<VisionItem> =>
	visionItemRepo.create(await getDriver(), input);
export const updateVisionItem = async (id: number, input: VisionItemInput): Promise<VisionItem> =>
	visionItemRepo.update(await getDriver(), id, input);
export const deleteVisionItem = async (id: number): Promise<void> => {
	const item = await visionItemRepo.get(await getDriver(), id);
	if (item.imagePath) await deleteImage(item.imagePath);
	await visionItemRepo.remove(await getDriver(), id);
};
export const reorderVisionItems = async (orderedIds: number[]): Promise<void> =>
	visionItemRepo.reorder(await getDriver(), orderedIds);
```

## 6. Frontend

**Route.** `app/src/routes/vision-board/+page.ts` + `+page.svelte`, same load-then-render shape
as `ideas/+page.ts`.

**Nav.** `+layout.svelte`'s `NAV` array gains
`{ href: '/vision-board', label: 'Vision Board', icon: 'image' }`.

**`VisionBoard.svelte`.** CSS multi-column masonry container. Each card is `break-inside-avoid`,
shows its image (if any) and quote text (if any) stacked, with hover-revealed edit/delete icon
buttons — same icon-button affordance already used on `SubgoalCard`/`TaskRow`. Cards are
`draggable`; `dragstart` records the source id, `dragover`/`drop` on a card reorders by swapping
the dragged id to that position and calling `reorderVisionItems` with the full new id order,
mirroring `KanbanBoard.svelte`'s `dragOver`/`dragLeave`/`drop` handlers structurally (columns
there, card positions here).

An always-present "+" tile at the start of the grid opens `VisionItemDrawer` in create mode.
Empty state (no items yet) replaces the grid with a centered prompt + the same "+" affordance.

**`VisionItemDrawer.svelte`.** New component, same shape as `IdeaDrawer`/`GoalDrawer`:
- Image picker: a button ("Choose image" / "Replace image") calling `pickAndCopyImage()`, plus a
  thumbnail preview of the currently-picked image and a "Remove image" action that clears it
  client-side (the actual file delete happens on save via the API layer, consistent with how
  removing/replacing only takes effect on submit elsewhere in the app, e.g. `GoalDrawer` only
  writes on `submit()`).
- Quote textarea, optional.
- Validation: shake + inline message if both are empty on submit, same visual pattern as
  `GoalDrawer`'s `titleMissing`/`urlInvalid` shake.

## 7. Testing

- `app/src/lib/db/repo/visionItem.spec.ts` against `testDriver`/`testSchema`, mirroring
  `subgoal.spec.ts`: create appends at `max(position)+1`, create rejects empty image+quote,
  update validates the same way, remove deletes the row, reorder rewrites positions for a given
  id order.
- `app/src/lib/images.spec.ts` if the copy/delete logic in `images.ts` has any pure/testable
  seams (path-building, extension extraction); the actual dialog/fs plugin calls are
  Tauri-runtime-only and untested here, consistent with how no test exercises the real
  `plugin-sql` driver either (tests run against `node:sqlite`).
- No component-level (`.svelte`) tests — matches current convention.

## Out of scope

- Any pull-in from Goals or Ideas (motivation text/image, idea notes) — full reversal of the
  original plan doc's wording; may be revisited as a later phase but is not part of this one.
- Filtering by category or goal — no linking fields exist on `vision_items` to filter by.
- Multiple images per card, image cropping/editing, or drag-and-drop file upload directly onto
  the board (picker-only for v1).
