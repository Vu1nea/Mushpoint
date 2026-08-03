# Ideas Storage (Phase 5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a low-friction idea capture inbox (title, optional note, tags) with a "Promote to Goal" action that hands off into the existing Goal creation flow, per `docs/superpowers/specs/2026-08-03-ideas-storage-design.md`.

**Architecture:** New `ideas` / `idea_tags` / `idea_tag_links` tables (migration 4), a repo layer mirroring `goal.ts`/`subgoal.ts`, and a new `/ideas` route with its own drawer. `GoalSummary`/`GoalDetail` gain a computed `fromIdea` flag via a second query keyed by goal id, matching how `goal.list`/`getDetail` already do per-row lookups for subgoal/task counts. Promoting an idea reuses the existing `GoalDrawer` (given a small prefill prop for the create path) rather than building a second goal-creation form.

**Tech Stack:** SvelteKit 5 (runes), TypeScript, `tauri-plugin-sql` (sqlx/SQLite) for the real app, `node:sqlite` in-memory driver for vitest.

## Global Constraints

- Tag model is normalized (`idea_tags` + `idea_tag_links`), not freeform CSV text. Tags are get-or-create by name, case-insensitively (`UNIQUE ... COLLATE NOCASE`) — no tag management screen.
- Promoting an idea sets `promoted_goal_id` and hides it from the default inbox list (`promoted_goal_id IS NULL` filter); it is never deleted. `includePromoted` exists on the repo `list` function for future use — no UI toggle this phase.
- `promoted_goal_id` is `ON DELETE SET NULL` — deleting the promoted Goal resurfaces the idea in the inbox automatically.
- Promote opens the existing `GoalDrawer` pre-filled (`title`, `note` → `description`); category/timeframe are left for the user — `GoalDrawer`'s existing required-field validation is untouched.
- `GoalSummary`/`GoalDetail` gain `fromIdea: boolean`; wherever a Goal's title renders (goal list card, goal detail header) show the existing `idea` icon inline with `title="Promoted from an idea"`, tooltip only, no click behavior.
- The note field is a plain textarea — no markdown rendering, matching every other free-text field in the app.
- New migration must be registered in `app/src-tauri/src/lib.rs` as version 4, and mirrored verbatim in `app/src/lib/db/testSchema.ts` (the file's own header comment says to keep these in sync).
- No component-level (`.svelte`) tests — matches current convention; none of `GoalDrawer`, `TaskDrawer`, `KanbanBoard`, etc. have specs today.
- Out of scope: browsing already-promoted ideas, markdown rendering, tag management (rename/merge/delete), preventing edits to a promoted idea's title/note/tags.

---

### Task 1: Schema, types, and idea repo layer

**Files:**
- Create: `app/src-tauri/migrations/0004_ideas.sql`
- Modify: `app/src-tauri/src/lib.rs` (register migration version 4)
- Modify: `app/src/lib/db/testSchema.ts` (mirror the new tables)
- Modify: `app/src/lib/api/types.ts` (add `Tag`, `Idea`, `IdeaInput`)
- Create: `app/src/lib/db/repo/idea.ts`
- Test: `app/src/lib/db/repo/idea.spec.ts`

**Interfaces:**
- Consumes: `now()`, `optionalText()`, `requiredText()` from `app/src/lib/db/repo/helpers.ts` (existing); `AppError.notFound`/`AppError.validation` from `app/src/lib/db/error.ts` (existing).
- Produces: `Tag { id: number; name: string }`, `Idea { id, title, note, promotedGoalId, tags: Tag[], createdAt, updatedAt }`, `IdeaInput { title, note, tagNames: string[] }` — consumed by Task 2 (goal.ts), Task 3 (api surface), and every frontend task. Repo functions `list`, `get`, `create`, `update`, `remove`, `promote`, `listTags` — consumed by Task 3.

- [ ] **Step 1: Write the failing tests**

Create `app/src/lib/db/repo/idea.spec.ts`:

```typescript
import { beforeEach, describe, expect, it } from 'vitest';
import type { SqlDriver } from '../driver';
import { createTestDriver } from '../testDriver';
import * as goal from './goal';
import * as idea from './idea';
import type { GoalInput, IdeaInput } from '../../api/types';

let driver: SqlDriver;

beforeEach(() => {
	driver = createTestDriver();
});

function ideaInput(title: string, tagNames: string[] = []): IdeaInput {
	return { title, note: null, tagNames };
}

function goalInput(title: string): GoalInput {
	return {
		categoryId: null,
		title,
		description: null,
		timeframe: 'mid',
		dueDate: null,
		motivationText: null,
		motivationImagePath: null,
		repoUrl: null
	};
}

describe('idea', () => {
	it('creates an idea with tags', async () => {
		const created = await idea.create(driver, ideaInput('Learn Rust', ['cs', 'winter break']));
		expect(created.title).toBe('Learn Rust');
		expect(created.promotedGoalId).toBeNull();
		expect(created.tags.map((t) => t.name)).toEqual(['cs', 'winter break']);
	});

	it('lists active ideas by default, excluding promoted ones', async () => {
		const kept = await idea.create(driver, ideaInput('Keep me'));
		const promoted = await idea.create(driver, ideaInput('Promote me'));
		const goalCreated = await goal.create(driver, goalInput('A goal'));
		await idea.promote(driver, promoted.id, goalCreated.id);

		const active = await idea.list(driver);
		expect(active.map((i) => i.id)).toEqual([kept.id]);

		const all = await idea.list(driver, { includePromoted: true });
		expect(all).toHaveLength(2);
		expect(all.some((i) => i.id === promoted.id)).toBe(true);
	});

	it('filters by tag, case-insensitively', async () => {
		await idea.create(driver, ideaInput('Tagged', ['CS']));
		await idea.create(driver, ideaInput('Untagged'));

		const filtered = await idea.list(driver, { tag: 'cs' });
		expect(filtered.map((i) => i.title)).toEqual(['Tagged']);
	});

	it('get-or-create collapses tags that differ only by case', async () => {
		const first = await idea.create(driver, ideaInput('First', ['CS']));
		const second = await idea.create(driver, ideaInput('Second', ['cs']));

		expect(first.tags[0].id).toBe(second.tags[0].id);
		expect(await idea.listTags(driver)).toHaveLength(1);
	});

	it('promote sets promoted_goal_id and the idea drops out of the default list', async () => {
		const created = await idea.create(driver, ideaInput('An idea'));
		const goalCreated = await goal.create(driver, goalInput('A goal'));

		const promoted = await idea.promote(driver, created.id, goalCreated.id);
		expect(promoted.promotedGoalId).toBe(goalCreated.id);
		expect(await idea.list(driver)).toHaveLength(0);
	});

	it('resurfaces in the inbox when the promoted goal is deleted', async () => {
		const created = await idea.create(driver, ideaInput('An idea'));
		const goalCreated = await goal.create(driver, goalInput('A goal'));
		await idea.promote(driver, created.id, goalCreated.id);

		await goal.remove(driver, goalCreated.id, false);

		const resurfaced = await idea.get(driver, created.id);
		expect(resurfaced.promotedGoalId).toBeNull();
		expect(await idea.list(driver)).toHaveLength(1);
	});

	it('removing an idea cascades its tag links but leaves the tag itself', async () => {
		const created = await idea.create(driver, ideaInput('An idea', ['cs']));
		await idea.remove(driver, created.id);

		await expect(idea.get(driver, created.id)).rejects.toMatchObject({ kind: 'not_found' });
		expect(await idea.listTags(driver)).toHaveLength(1);
	});

	it('update replaces tag links wholesale rather than diffing', async () => {
		const created = await idea.create(driver, ideaInput('An idea', ['a', 'b']));
		const updated = await idea.update(driver, created.id, ideaInput('An idea', ['b', 'c']));

		expect(updated.tags.map((t) => t.name)).toEqual(['b', 'c']);
	});

	it('rejects a blank title', async () => {
		await expect(idea.create(driver, ideaInput('  '))).rejects.toMatchObject({ kind: 'validation' });
	});
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd app && npx vitest run src/lib/db/repo/idea.spec.ts`
Expected: FAIL — `Cannot find module './idea'` (nothing exists yet).

- [ ] **Step 3: Add the migration**

Create `app/src-tauri/migrations/0004_ideas.sql`:

```sql
CREATE TABLE ideas (
    id                INTEGER PRIMARY KEY,
    title             TEXT    NOT NULL,
    note              TEXT,
    promoted_goal_id  INTEGER REFERENCES goals(id) ON DELETE SET NULL,
    created_at        TEXT    NOT NULL,
    updated_at        TEXT    NOT NULL
);
CREATE INDEX idx_ideas_promoted ON ideas(promoted_goal_id);

CREATE TABLE idea_tags (
    id         INTEGER PRIMARY KEY,
    name       TEXT NOT NULL UNIQUE COLLATE NOCASE,
    created_at TEXT NOT NULL
);

CREATE TABLE idea_tag_links (
    idea_id INTEGER NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
    tag_id  INTEGER NOT NULL REFERENCES idea_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (idea_id, tag_id)
);
CREATE INDEX idx_idea_tag_links_tag ON idea_tag_links(tag_id);
```

- [ ] **Step 4: Register the migration**

Edit `app/src-tauri/src/lib.rs`. Add a fourth entry to the `migrations()` vec, after `goal_repo_url`:

```rust
        Migration {
            version: 4,
            description: "ideas",
            sql: include_str!("../migrations/0004_ideas.sql"),
            kind: MigrationKind::Up,
        },
```

- [ ] **Step 5: Mirror the tables in the test schema**

Edit `app/src/lib/db/testSchema.ts`. Add the three tables at the end of the template literal, right after the `idx_completions_task` index and before the closing backtick:

```sql

CREATE TABLE ideas (
    id                INTEGER PRIMARY KEY,
    title             TEXT    NOT NULL,
    note              TEXT,
    promoted_goal_id  INTEGER REFERENCES goals(id) ON DELETE SET NULL,
    created_at        TEXT    NOT NULL,
    updated_at        TEXT    NOT NULL
);
CREATE INDEX idx_ideas_promoted ON ideas(promoted_goal_id);

CREATE TABLE idea_tags (
    id         INTEGER PRIMARY KEY,
    name       TEXT NOT NULL UNIQUE COLLATE NOCASE,
    created_at TEXT NOT NULL
);

CREATE TABLE idea_tag_links (
    idea_id INTEGER NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
    tag_id  INTEGER NOT NULL REFERENCES idea_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (idea_id, tag_id)
);
CREATE INDEX idx_idea_tag_links_tag ON idea_tag_links(tag_id);
```

Also update the file's header comment to read `Mirrors app/src-tauri/migrations/0001_initial.sql + 0002_streaks.sql + 0003_repo_url.sql + 0004_ideas.sql exactly.`

- [ ] **Step 6: Add the types**

Edit `app/src/lib/api/types.ts`. Add after the `SubgoalUpdate` interface (before `Task`):

```typescript
export interface Tag {
	id: number;
	name: string;
}

export interface Idea {
	id: number;
	title: string;
	note: string | null;
	promotedGoalId: number | null;
	tags: Tag[];
	createdAt: string;
	updatedAt: string;
}

export interface IdeaInput {
	title: string;
	note: string | null;
	tagNames: string[];
}
```

Add `fromIdea: boolean;` to both `GoalSummary` and `GoalDetail`:

```typescript
export interface GoalSummary extends Goal {
	progress: number;
	subgoalCount: number;
	taskCount: number;
	fromIdea: boolean;
}
```

```typescript
export interface GoalDetail extends Goal {
	progress: number;
	category: Category | null;
	subgoals: SubgoalDetail[];
	directTasks: TaskSummary[];
	fromIdea: boolean;
}
```

- [ ] **Step 7: Write the idea repo layer**

Create `app/src/lib/db/repo/idea.ts`:

```typescript
import type { SqlDriver } from '../driver';
import { AppError } from '../error';
import type { Idea, IdeaInput, Tag } from '../../api/types';
import { now, optionalText, requiredText } from './helpers';

const COLUMNS = 'i.id, i.title, i.note, i.promoted_goal_id, i.created_at, i.updated_at';

interface IdeaRow {
	id: number;
	title: string;
	note: string | null;
	promoted_goal_id: number | null;
	created_at: string;
	updated_at: string;
}

interface TagRow {
	id: number;
	name: string;
}

function mapTag(row: TagRow): Tag {
	return { id: row.id, name: row.name };
}

async function tagsForIdea(driver: SqlDriver, ideaId: number): Promise<Tag[]> {
	const rows = await driver.select<TagRow>(
		`SELECT t.id, t.name FROM idea_tags t
         JOIN idea_tag_links l ON l.tag_id = t.id
         WHERE l.idea_id = ?1
         ORDER BY t.name`,
		[ideaId]
	);
	return rows.map(mapTag);
}

async function map(driver: SqlDriver, row: IdeaRow): Promise<Idea> {
	return {
		id: row.id,
		title: row.title,
		note: row.note,
		promotedGoalId: row.promoted_goal_id,
		tags: await tagsForIdea(driver, row.id),
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

/** Get-or-create by case-insensitive name — there is no separate tag
 * management screen, so "CS" and "cs" must resolve to the same row. */
async function resolveTagId(driver: SqlDriver, name: string): Promise<number> {
	const existing = await driver.select<{ id: number }>(
		'SELECT id FROM idea_tags WHERE name = ?1 COLLATE NOCASE',
		[name]
	);
	if (existing.length > 0) return existing[0].id;

	const result = await driver.execute('INSERT INTO idea_tags (name, created_at) VALUES (?1, ?2)', [
		name,
		now()
	]);
	return result.lastInsertId;
}

/** Replaces an idea's tag links wholesale rather than diffing — simpler, and
 * the tag list is short enough that this is never a performance concern. */
async function setTags(driver: SqlDriver, ideaId: number, tagNames: string[]): Promise<void> {
	await driver.execute('DELETE FROM idea_tag_links WHERE idea_id = ?1', [ideaId]);
	for (const raw of tagNames) {
		const name = raw.trim();
		if (!name) continue;
		const tagId = await resolveTagId(driver, name);
		await driver.execute('INSERT OR IGNORE INTO idea_tag_links (idea_id, tag_id) VALUES (?1, ?2)', [
			ideaId,
			tagId
		]);
	}
}

/** The inbox: unpromoted ideas by default, optionally narrowed to one tag.
 * `includePromoted` exists for a future browse view — nothing flips it yet. */
export async function list(
	driver: SqlDriver,
	{ tag, includePromoted = false }: { tag?: string; includePromoted?: boolean } = {}
): Promise<Idea[]> {
	const conditions: string[] = [];
	const params: unknown[] = [];

	if (!includePromoted) conditions.push('i.promoted_goal_id IS NULL');
	if (tag) {
		params.push(tag);
		conditions.push(
			`i.id IN (
                SELECT l.idea_id FROM idea_tag_links l
                JOIN idea_tags t ON t.id = l.tag_id
                WHERE t.name = ?${params.length} COLLATE NOCASE
            )`
		);
	}

	const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
	const rows = await driver.select<IdeaRow>(
		`SELECT ${COLUMNS} FROM ideas i ${where} ORDER BY i.created_at DESC, i.id DESC`,
		params
	);

	const ideas: Idea[] = [];
	for (const row of rows) ideas.push(await map(driver, row));
	return ideas;
}

export async function get(driver: SqlDriver, id: number): Promise<Idea> {
	const rows = await driver.select<IdeaRow>(`SELECT ${COLUMNS} FROM ideas i WHERE i.id = ?1`, [id]);
	const row = rows[0];
	if (!row) throw AppError.notFound('idea', id);
	return map(driver, row);
}

export async function create(driver: SqlDriver, input: IdeaInput): Promise<Idea> {
	const title = requiredText('idea title', input.title);
	const timestamp = now();

	const result = await driver.execute(
		'INSERT INTO ideas (title, note, promoted_goal_id, created_at, updated_at) VALUES (?1, ?2, NULL, ?3, ?3)',
		[title, optionalText(input.note), timestamp]
	);

	await setTags(driver, result.lastInsertId, input.tagNames);
	return get(driver, result.lastInsertId);
}

export async function update(driver: SqlDriver, id: number, input: IdeaInput): Promise<Idea> {
	const title = requiredText('idea title', input.title);

	const result = await driver.execute(
		'UPDATE ideas SET title = ?1, note = ?2, updated_at = ?3 WHERE id = ?4',
		[title, optionalText(input.note), now(), id]
	);
	if (result.rowsAffected === 0) throw AppError.notFound('idea', id);

	await setTags(driver, id, input.tagNames);
	return get(driver, id);
}

/** Tag links cascade-drop via FK; the tags themselves survive for reuse. */
export async function remove(driver: SqlDriver, id: number): Promise<void> {
	const result = await driver.execute('DELETE FROM ideas WHERE id = ?1', [id]);
	if (result.rowsAffected === 0) throw AppError.notFound('idea', id);
}

export async function promote(driver: SqlDriver, id: number, goalId: number): Promise<Idea> {
	const result = await driver.execute(
		'UPDATE ideas SET promoted_goal_id = ?1, updated_at = ?2 WHERE id = ?3',
		[goalId, now(), id]
	);
	if (result.rowsAffected === 0) throw AppError.notFound('idea', id);
	return get(driver, id);
}

/** Every existing tag, for the filter-chip row. */
export async function listTags(driver: SqlDriver): Promise<Tag[]> {
	const rows = await driver.select<TagRow>('SELECT id, name FROM idea_tags ORDER BY name');
	return rows.map(mapTag);
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `cd app && npx vitest run src/lib/db/repo/idea.spec.ts`
Expected: PASS (9 tests)

- [ ] **Step 9: Commit**

```bash
cd app
git add src-tauri/migrations/0004_ideas.sql src-tauri/src/lib.rs src/lib/db/testSchema.ts src/lib/api/types.ts src/lib/db/repo/idea.ts src/lib/db/repo/idea.spec.ts
git commit -m "feat: add ideas schema and repo layer"
```

---

### Task 2: `fromIdea` on Goal list/detail

**Files:**
- Modify: `app/src/lib/db/repo/goal.ts`
- Modify: `app/src/lib/db/repo/goal.spec.ts`

**Interfaces:**
- Consumes: `Idea`, `IdeaInput` types and `idea.create`/`idea.promote` from Task 1 (test only — `goal.ts` itself queries the `ideas` table directly with raw SQL, no import of `idea.ts`, to avoid a needless module dependency for a single lookup).
- Produces: `GoalSummary.fromIdea`, `GoalDetail.fromIdea` populated — consumed by Task 7 (goal-side indicator).

- [ ] **Step 1: Write the failing test**

Edit `app/src/lib/db/repo/goal.spec.ts`. Add the import at the top, alongside the existing ones:

```typescript
import * as idea from './idea';
```

Add this test at the end of the `describe('goal', ...)` block, right before the closing `});`:

```typescript
	it('flags a goal as fromIdea once an idea promotes into it', async () => {
		const created = await goal.create(driver, input('Ship v1'));
		const [summaryBefore] = await goal.list(driver, null);
		expect(summaryBefore.fromIdea).toBe(false);
		expect((await goal.getDetail(driver, created.id)).fromIdea).toBe(false);

		const createdIdea = await idea.create(driver, { title: 'An idea', note: null, tagNames: [] });
		await idea.promote(driver, createdIdea.id, created.id);

		const [summaryAfter] = await goal.list(driver, null);
		expect(summaryAfter.fromIdea).toBe(true);
		expect((await goal.getDetail(driver, created.id)).fromIdea).toBe(true);
	});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd app && npx vitest run src/lib/db/repo/goal.spec.ts`
Expected: FAIL — TypeScript error, `fromIdea` does not exist on type `GoalSummary`/`GoalDetail` yet (Task 1 added the type field; `goal.ts` doesn't populate it yet).

- [ ] **Step 3: Wire `fromIdea` into `goal.ts`**

Edit `app/src/lib/db/repo/goal.ts`. Add this helper function right after the `map()` function:

```typescript
/** Which of these goal ids were promoted from an idea. One query keyed by
 * the goal id set, same shape as how `list`/`getDetail` already do per-row
 * lookups for subgoal/task counts — avoids an extra query per goal. */
async function fromIdeaIds(driver: SqlDriver, goalIds: number[]): Promise<Set<number>> {
	if (goalIds.length === 0) return new Set();
	const placeholders = goalIds.map((_, i) => `?${i + 1}`).join(', ');
	const rows = await driver.select<{ promoted_goal_id: number }>(
		`SELECT promoted_goal_id FROM ideas WHERE promoted_goal_id IN (${placeholders})`,
		goalIds
	);
	return new Set(rows.map((r) => r.promoted_goal_id));
}
```

Replace the body of `list()`:

```typescript
export async function list(driver: SqlDriver, status: GoalStatus | null): Promise<GoalSummary[]> {
	const filter = status !== null ? 'WHERE status = ?1' : '';
	const rows = await driver.select<GoalRow>(
		`SELECT ${COLUMNS} FROM goals ${filter} ${ORDER}`,
		status !== null ? [status] : []
	);
	const mapped = rows.map(map);
	const fromIdea = await fromIdeaIds(driver, mapped.map((row) => row.id));

	const summaries: GoalSummary[] = [];
	for (const row of mapped) {
		const subgoalProgresses = await subgoal.progressesForGoal(driver, row.id);
		const directTasks = await task.listDirectForGoal(driver, row.id);
		const completions = directTasks.filter(countsTowardProgress).map((t) => taskCompletion(t.status));

		summaries.push({
			...row,
			progress: goalProgress(subgoalProgresses, completions),
			subgoalCount: subgoalProgresses.length,
			taskCount: directTasks.length,
			fromIdea: fromIdea.has(row.id)
		});
	}
	return summaries;
}
```

Replace the body of `getDetail()`:

```typescript
export async function getDetail(driver: SqlDriver, id: number): Promise<GoalDetail> {
	const goal = await get(driver, id);
	const subgoals = await subgoal.detailForGoal(driver, id);
	const directTasks = await task.listDirectForGoal(driver, id);

	const subgoalProgresses = subgoals.map((s) => s.progress);
	const completions = directTasks.filter(countsTowardProgress).map((t) => taskCompletion(t.status));
	const category_ = goal.categoryId !== null ? await category.get(driver, goal.categoryId) : null;
	const fromIdea = (await fromIdeaIds(driver, [id])).has(id);

	return {
		...goal,
		progress: goalProgress(subgoalProgresses, completions),
		category: category_,
		subgoals,
		directTasks,
		fromIdea
	};
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd app && npx vitest run src/lib/db/repo/goal.spec.ts`
Expected: PASS — all tests in the file, including the new `fromIdea` one.

- [ ] **Step 5: Commit**

```bash
cd app
git add src/lib/db/repo/goal.ts src/lib/db/repo/goal.spec.ts
git commit -m "feat: flag goals promoted from an idea"
```

---

### Task 3: API surface

**Files:**
- Modify: `app/src/lib/api/index.ts`

**Interfaces:**
- Consumes: `idea.list/get/create/update/remove/promote/listTags` (Task 1); `Idea`, `IdeaInput`, `Tag` types (Task 1, re-exported already via `export * from './types'`).
- Produces: `listIdeas`, `getIdea`, `createIdea`, `updateIdea`, `deleteIdea`, `promoteIdea`, `listIdeaTags` — consumed by every frontend task (4–7).

- [ ] **Step 1: Add the idea repo import**

Edit `app/src/lib/api/index.ts`. Add alongside the existing repo imports:

```typescript
import * as ideaRepo from '../db/repo/idea';
```

- [ ] **Step 2: Add the type imports**

Add `Idea`, `IdeaInput`, `Tag` to the existing `import type { ... } from './types'` block, keeping the list alphabetical:

```typescript
import type {
	Category,
	CategoryInput,
	Goal,
	GoalDetail,
	GoalInput,
	GoalStatus,
	GoalSummary,
	Idea,
	IdeaInput,
	StreakCard,
	Subgoal,
	SubgoalInput,
	SubgoalUpdate,
	Tag,
	Task,
	TaskInput,
	TaskStatus,
	TaskSummary,
	TaskUpdate
} from './types';
```

- [ ] **Step 3: Add the exports**

Add at the end of the file, after the `setTaskCompletion` export:

```typescript
export const listIdeas = async (opts?: { tag?: string; includePromoted?: boolean }): Promise<Idea[]> =>
	ideaRepo.list(await getDriver(), opts);
export const getIdea = async (id: number): Promise<Idea> => ideaRepo.get(await getDriver(), id);
export const createIdea = async (input: IdeaInput): Promise<Idea> =>
	ideaRepo.create(await getDriver(), input);
export const updateIdea = async (id: number, input: IdeaInput): Promise<Idea> =>
	ideaRepo.update(await getDriver(), id, input);
export const deleteIdea = async (id: number): Promise<void> => ideaRepo.remove(await getDriver(), id);
export const promoteIdea = async (id: number, goalId: number): Promise<Idea> =>
	ideaRepo.promote(await getDriver(), id, goalId);
export const listIdeaTags = async (): Promise<Tag[]> => ideaRepo.listTags(await getDriver());
```

- [ ] **Step 4: Typecheck and run the full unit suite**

Run: `cd app && npx vitest run --project server && npx svelte-check --tsconfig ./tsconfig.json`
Expected: PASS — no type errors, no regressions in existing specs.

- [ ] **Step 5: Commit**

```bash
cd app
git add src/lib/api/index.ts
git commit -m "feat: expose idea CRUD on the api surface"
```

---

### Task 4: `TagInput.svelte` shared component

**Files:**
- Create: `app/src/lib/components/TagInput.svelte`

**Interfaces:**
- Consumes: `Icon` component (`app/src/lib/components/Icon.svelte`, existing, `name: 'close'`).
- Produces: default export `TagInput.svelte` with

  ```ts
  interface Props {
  	tags: string[]; // $bindable
  	id?: string;
  	placeholder?: string;
  	ariaLabel?: string;
  }
  ```

  consumed by Task 5 (`IdeaDrawer.svelte`) and Task 6 (the ideas page quick-add bar).

- [ ] **Step 1: Write the component**

Create `app/src/lib/components/TagInput.svelte`:

```svelte
<!-- app/src/lib/components/TagInput.svelte -->
<script lang="ts">
	import Icon from './Icon.svelte';

	interface Props {
		tags: string[];
		id?: string;
		placeholder?: string;
		ariaLabel?: string;
	}

	let { tags = $bindable(), id, placeholder = 'Add a tag…', ariaLabel }: Props = $props();

	let draft = $state('');

	/** Commits whatever's typed so far as a tag — used on comma, Enter, and
	 * blur, so a stray unfinished tag is never silently dropped. */
	function commit() {
		const name = draft.trim();
		draft = '';
		if (name && !tags.includes(name)) tags = [...tags, name];
	}

	function remove(name: string) {
		tags = tags.filter((tag) => tag !== name);
	}

	function onkeydown(event: KeyboardEvent) {
		if (event.key === ',' || event.key === 'Enter') {
			event.preventDefault();
			commit();
		} else if (event.key === 'Backspace' && draft === '' && tags.length > 0) {
			tags = tags.slice(0, -1);
		}
	}
</script>

<div
	class="flex flex-wrap items-center gap-1.5 rounded-control border border-subtle bg-track px-2.5 py-2"
>
	{#each tags as tag (tag)}
		<span
			class="flex items-center gap-1 rounded-full bg-accent/15 px-2.5 py-0.5 text-2xs font-semibold text-accent"
		>
			{tag}
			<button
				type="button"
				class="text-accent/70 transition-colors hover:text-accent"
				onclick={() => remove(tag)}
			>
				<Icon name="close" size={10} weight={2.4} label="Remove tag {tag}" />
			</button>
		</span>
	{/each}
	<input
		{id}
		type="text"
		class="min-w-24 flex-1 bg-transparent text-sm text-content outline-none placeholder:text-muted/60"
		bind:value={draft}
		{placeholder}
		aria-label={ariaLabel}
		{onkeydown}
		onblur={commit}
	/>
</div>
```

- [ ] **Step 2: Typecheck**

Run: `cd app && npx svelte-check --tsconfig ./tsconfig.json`
Expected: no new errors from `TagInput.svelte` (it isn't imported anywhere yet, so this only catches syntax/type mistakes inside the file itself).

- [ ] **Step 3: Commit**

```bash
cd app
git add src/lib/components/TagInput.svelte
git commit -m "feat: add TagInput chip component"
```

---

### Task 5: `IdeaDrawer.svelte` component

**Files:**
- Create: `app/src/lib/components/IdeaDrawer.svelte`

**Interfaces:**
- Consumes: `createIdea(input: IdeaInput): Promise<Idea>`, `updateIdea(id: number, input: IdeaInput): Promise<Idea>`, `type Idea` from `$lib/api` (Task 3); `Drawer.svelte` (`open`, `title`, `submitLabel`, `submitting`, `error`, `onClose`, `onSubmit`, existing); `TagInput.svelte` (Task 4); `field` from `./ui` (existing).
- Produces: default export `IdeaDrawer.svelte` with

  ```ts
  interface Props {
  	open: boolean;
  	idea?: Idea | null; // null creates; an Idea edits it in place
  	onClose: () => void;
  	onSaved: () => Promise<void> | void;
  }
  ```

  consumed by Task 6 (`app/src/routes/ideas/+page.svelte`).

- [ ] **Step 1: Write the component**

Create `app/src/lib/components/IdeaDrawer.svelte`:

```svelte
<!-- app/src/lib/components/IdeaDrawer.svelte -->
<script lang="ts">
	import { createIdea, updateIdea, type Idea } from '$lib/api';
	import Drawer from './Drawer.svelte';
	import Icon from './Icon.svelte';
	import TagInput from './TagInput.svelte';
	import { field } from './ui';

	interface Props {
		open: boolean;
		/** Null creates an idea; an idea edits it in place. */
		idea?: Idea | null;
		onClose: () => void;
		onSaved: () => Promise<void> | void;
	}

	let { open, idea = null, onClose, onSaved }: Props = $props();

	let submitting = $state(false);
	let error = $state<unknown>(null);
	let titleMissing = $state(false);
	let shake = $state(false);

	let form = $state({ title: '', note: '', tags: [] as string[] });

	// Each opening starts from the record being edited, or from a blank idea.
	$effect(() => {
		if (!open) return;
		error = null;
		titleMissing = false;
		form = {
			title: idea?.title ?? '',
			note: idea?.note ?? '',
			tags: idea?.tags.map((tag) => tag.name) ?? []
		};
	});

	async function submit() {
		if (!form.title.trim()) {
			titleMissing = true;
			shake = true;
			return;
		}

		submitting = true;
		error = null;
		const input = {
			title: form.title.trim(),
			note: form.note.trim() || null,
			tagNames: form.tags
		};

		try {
			await (idea ? updateIdea(idea.id, input) : createIdea(input));
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
	title={idea ? 'Edit Idea' : 'New Idea'}
	submitLabel={idea ? 'Save' : 'Create'}
	{submitting}
	{error}
	{onClose}
	onSubmit={submit}
>
	<div>
		<label class={field.label} for="idea-title">Title</label>
		<input
			id="idea-title"
			class="{field.input} {titleMissing ? 'border-warn' : ''} {shake ? 'mp-shake' : ''}"
			bind:value={form.title}
			oninput={() => (titleMissing = false)}
			onanimationend={() => (shake = false)}
			placeholder="What's the idea…"
			aria-invalid={titleMissing}
		/>
		{#if titleMissing}
			<p class="mt-1.5 flex items-center gap-1.5 text-xs text-warn">
				<Icon name="warning" size={13} weight={2} /> Title is required
			</p>
		{/if}
	</div>

	<div>
		<label class={field.label} for="idea-note">Note (optional)</label>
		<textarea
			id="idea-note"
			class="{field.input} resize-y"
			rows="3"
			bind:value={form.note}
			placeholder="Any detail worth keeping…"
		></textarea>
	</div>

	<div>
		<span class={field.label}>Tags</span>
		<TagInput bind:tags={form.tags} ariaLabel="Idea tags" placeholder="Add tags…" />
	</div>
</Drawer>
```

- [ ] **Step 2: Typecheck**

Run: `cd app && npx svelte-check --tsconfig ./tsconfig.json`
Expected: no new errors from `IdeaDrawer.svelte` (it isn't imported anywhere yet).

- [ ] **Step 3: Commit**

```bash
cd app
git add src/lib/components/IdeaDrawer.svelte
git commit -m "feat: add IdeaDrawer component"
```

---

### Task 6: Ideas route, nav entry, and the Promote flow

**Files:**
- Create: `app/src/routes/ideas/+page.ts`
- Create: `app/src/routes/ideas/+page.svelte`
- Modify: `app/src/routes/+layout.svelte` (nav entry)
- Modify: `app/src/lib/components/GoalDrawer.svelte` (create-mode prefill, `onSaved` now receives the saved Goal)

**Interfaces:**
- Consumes: `listIdeas`, `listIdeaTags`, `listCategories`, `createIdea`, `deleteIdea`, `promoteIdea`, `type Goal`, `type Idea` from `$lib/api`; `IdeaDrawer.svelte` (Task 5); `TagInput.svelte` (Task 4); `GoalDrawer.svelte`, `ConfirmDialog.svelte`, `ErrorBanner.svelte`, `Icon.svelte` (existing); `button`, `chip`, `field` from `./ui` (existing); `stagger` from `$lib/motion` (existing).
- Produces: `/ideas` route; `GoalDrawer`'s `onSaved` prop changes from `() => Promise<void> | void` to `(goal: Goal) => Promise<void> | void` and gains an optional `prefill` prop — both existing call sites (`app/src/routes/goals/+page.svelte`, `app/src/routes/goals/[id]/+page.svelte`) pass `onSaved={invalidateAll}`, which stays valid unchanged (a callback declared with fewer parameters is always assignable where more are expected).

- [ ] **Step 1: Extend `GoalDrawer.svelte` for the Promote flow**

Edit `app/src/lib/components/GoalDrawer.svelte`. Replace the `Props` interface and the `let { ... }: Props = $props();` line:

```typescript
	interface Props {
		open: boolean;
		categories: Category[];
		/** Null creates a goal; a goal edits it in place. */
		goal?: Goal | null;
		/** Seeds a blank (create) drawer's initial title/description — used by
		 * the ideas Promote flow. Ignored once `goal` is set, since editing
		 * always starts from the record itself. */
		prefill?: { title: string; description: string | null } | null;
		onClose: () => void;
		/** Called with the created/updated goal after a successful save, before the drawer closes. */
		onSaved: (goal: Goal) => Promise<void> | void;
	}

	let { open, categories, goal = null, prefill = null, onClose, onSaved }: Props = $props();
```

Replace the form-reset `$effect`:

```typescript
	// Each opening starts from the record being edited, from the Promote
	// flow's prefill, or from a blank goal.
	$effect(() => {
		if (!open) return;
		error = null;
		titleMissing = false;
		urlInvalid = false;
		form = {
			title: goal?.title ?? prefill?.title ?? '',
			categoryId: goal?.categoryId ? String(goal.categoryId) : '',
			timeframe: goal?.timeframe ?? 'short',
			motivationText: goal?.motivationText ?? '',
			description: goal?.description ?? prefill?.description ?? '',
			dueDate: goal?.dueDate ?? '',
			repoUrl: goal?.repoUrl ?? ''
		};
	});
```

Replace the `try`/`catch` block inside `submit()`:

```typescript
		try {
			const saved = goal ? await updateGoal(goal.id, input) : await createGoal(input);
			await onSaved(saved);
			onClose();
		} catch (failure) {
			error = failure;
		} finally {
			submitting = false;
		}
```

- [ ] **Step 2: Typecheck the existing call sites**

Run: `cd app && npx svelte-check --tsconfig ./tsconfig.json`
Expected: PASS — `app/src/routes/goals/+page.svelte` and `app/src/routes/goals/[id]/+page.svelte` both pass `onSaved={invalidateAll}`, which remains assignable to the new one-argument signature.

- [ ] **Step 3: Add the nav entry**

Edit `app/src/routes/+layout.svelte`. Replace the `NAV` comment and array:

```typescript
	/**
	 * Sidebar entries for the screens that exist. The design also lists Dashboard,
	 * Project Manager and Vision Board; each is added here as its phase ships,
	 * rather than shipping a link that goes nowhere.
	 */
	const NAV: { href: string; label: string; icon: IconName }[] = [
		{ href: '/goals', label: 'Goal Tracker', icon: 'goal' },
		{ href: '/tasks', label: 'Task Manager', icon: 'task' },
		{ href: '/ideas', label: 'Idea Vault', icon: 'idea' },
		{ href: '/settings', label: 'Settings', icon: 'settings' }
	];
```

- [ ] **Step 4: Write the loader**

Create `app/src/routes/ideas/+page.ts`:

```typescript
import { listCategories, listIdeas, listIdeaTags } from '$lib/api';

export const load = async ({ url }) => {
	const tag = url.searchParams.get('tag') || undefined;

	try {
		const [ideas, tags, categories] = await Promise.all([
			listIdeas({ tag }),
			listIdeaTags(),
			listCategories()
		]);
		return { ideas, tags, categories, activeTag: tag ?? null, error: null };
	} catch (error) {
		// Shown in place, so the page and its navigation stay usable.
		return { ideas: [], tags: [], categories: [], activeTag: tag ?? null, error };
	}
};
```

- [ ] **Step 5: Write the page**

Create `app/src/routes/ideas/+page.svelte`:

```svelte
<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import {
		createIdea,
		deleteIdea,
		promoteIdea,
		type Goal,
		type Idea
	} from '$lib/api';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import ErrorBanner from '$lib/components/ErrorBanner.svelte';
	import GoalDrawer from '$lib/components/GoalDrawer.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import IdeaDrawer from '$lib/components/IdeaDrawer.svelte';
	import TagInput from '$lib/components/TagInput.svelte';
	import { button, chip, field } from '$lib/components/ui';
	import { stagger } from '$lib/motion';

	let { data } = $props();

	let busy = $state(false);
	let actionError = $state<unknown>(null);

	let drawerOpen = $state(false);
	let editingIdea = $state<Idea | null>(null);
	let deletingIdea = $state<Idea | null>(null);

	let promoteDrawerOpen = $state(false);
	let promotingIdea = $state<Idea | null>(null);

	let quickAdd = $state({ title: '', note: '', tags: [] as string[] });

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

	async function addIdea(event: SubmitEvent) {
		event.preventDefault();
		const title = quickAdd.title.trim();
		if (!title) return;

		const input = { title, note: quickAdd.note.trim() || null, tagNames: quickAdd.tags };
		quickAdd = { title: '', note: '', tags: [] };
		await run(() => createIdea(input));
	}

	function edit(idea: Idea) {
		editingIdea = idea;
		drawerOpen = true;
	}

	async function removeIdea() {
		const idea = deletingIdea;
		if (!idea) return;
		deletingIdea = null;
		await run(() => deleteIdea(idea.id));
	}

	function promote(idea: Idea) {
		promotingIdea = idea;
		promoteDrawerOpen = true;
	}

	function closePromoteDrawer() {
		promoteDrawerOpen = false;
		promotingIdea = null;
	}

	/** The idea only drops out of the inbox once the new goal exists and the
	 * promotion is recorded — both must succeed before the page reloads. */
	async function onGoalCreated(newGoal: Goal) {
		if (!promotingIdea) return;
		await run(() => promoteIdea(promotingIdea!.id, newGoal.id));
	}
</script>

<svelte:head><title>Idea Vault · Mushpoint</title></svelte:head>

<header class="mb-6 flex items-start justify-between gap-4">
	<div>
		<h1 class="mb-1 font-display text-3xl font-bold">Idea Vault</h1>
		<p class="text-sm text-muted">Capture it now, sort it later</p>
	</div>
	<button
		type="button"
		class={button.primary}
		onclick={() => {
			editingIdea = null;
			drawerOpen = true;
		}}
	>
		<Icon name="plus" size={15} weight={2.4} />
		New Idea
	</button>
</header>

{#if data.error}
	<div class="mb-6"><ErrorBanner error={data.error} /></div>
{/if}
{#if actionError}
	<div class="mb-6"><ErrorBanner error={actionError} onDismiss={() => (actionError = null)} /></div>
{/if}

<form
	class="mb-6 flex flex-col gap-3 rounded-card border border-subtle bg-surface p-4 sm:flex-row sm:items-start"
	onsubmit={addIdea}
>
	<div class="flex flex-1 flex-col gap-2">
		<input
			class="{field.dashed} w-full"
			bind:value={quickAdd.title}
			placeholder="Capture an idea…"
			aria-label="New idea title"
		/>
		<input
			class="{field.dashed} w-full text-sm"
			bind:value={quickAdd.note}
			placeholder="Optional note…"
			aria-label="New idea note"
		/>
		<TagInput bind:tags={quickAdd.tags} ariaLabel="Tags for the new idea" placeholder="Add tags…" />
	</div>
	<button type="submit" class={button.primary} disabled={busy}>
		<Icon name="plus" size={15} weight={2.4} />
		Add Idea
	</button>
</form>

{#if data.tags.length > 0}
	<nav class="mb-6 flex flex-wrap gap-2" aria-label="Filter ideas by tag">
		<a href="/ideas" aria-current={!data.activeTag ? 'page' : undefined} class={chip(!data.activeTag)}>
			All
		</a>
		{#each data.tags as tag (tag.id)}
			<a
				href="/ideas?tag={encodeURIComponent(tag.name)}"
				aria-current={data.activeTag === tag.name ? 'page' : undefined}
				class={chip(data.activeTag === tag.name)}
			>
				{tag.name}
			</a>
		{/each}
	</nav>
{/if}

{#if data.ideas.length === 0 && !data.error}
	<p class="px-5 py-12 text-center text-md text-muted">
		{data.activeTag ? `No ideas tagged “${data.activeTag}” yet.` : 'No ideas yet — capture one above.'}
	</p>
{:else}
	<ul class="flex flex-col gap-2.5">
		{#each data.ideas as idea, index (idea.id)}
			<li class="mp-enter" style="--mp-delay:{stagger(index)}">
				<article class="rounded-card border border-subtle bg-surface p-4">
					<div class="flex items-start gap-3">
						<div class="min-w-0 flex-1">
							<p class="truncate text-base font-semibold">{idea.title}</p>
							{#if idea.note}
								<p class="mt-1 line-clamp-2 text-sm text-muted">{idea.note}</p>
							{/if}
							{#if idea.tags.length > 0}
								<div class="mt-2 flex flex-wrap gap-1.5">
									{#each idea.tags as tag (tag.id)}
										<span
											class="rounded-full bg-accent/15 px-2.5 py-0.5 text-2xs font-semibold text-accent"
										>
											{tag.name}
										</span>
									{/each}
								</div>
							{/if}
						</div>
						<div class="flex shrink-0 gap-1">
							<button type="button" class={button.icon} onclick={() => edit(idea)}>
								<Icon name="edit" size={14} label="Edit {idea.title}" />
							</button>
							<button type="button" class={button.icon} onclick={() => promote(idea)}>
								<Icon name="goal" size={14} label="Promote {idea.title} to a goal" />
							</button>
							<button
								type="button"
								class={button.icon}
								disabled={busy}
								onclick={() => (deletingIdea = idea)}
							>
								<Icon name="trash" size={14} label="Delete {idea.title}" />
							</button>
						</div>
					</div>
				</article>
			</li>
		{/each}
	</ul>
{/if}

<IdeaDrawer
	open={drawerOpen}
	idea={editingIdea}
	onClose={() => (drawerOpen = false)}
	onSaved={invalidateAll}
/>

<GoalDrawer
	open={promoteDrawerOpen}
	categories={data.categories}
	prefill={promotingIdea ? { title: promotingIdea.title, description: promotingIdea.note } : null}
	onClose={closePromoteDrawer}
	onSaved={onGoalCreated}
/>

<ConfirmDialog
	open={deletingIdea !== null}
	title="Delete “{deletingIdea?.title ?? ''}”?"
	body="This cannot be undone."
	{busy}
	onConfirm={removeIdea}
	onCancel={() => (deletingIdea = null)}
/>
```

Note on `onGoalCreated`/`closePromoteDrawer`: `GoalDrawer.submit()` runs `await onSaved(saved); onClose();` in sequence, so `promoteIdea` has already resolved (and `invalidateAll` already reloaded `data.ideas` without the now-promoted idea) by the time `closePromoteDrawer` clears `promotingIdea`. If the user cancels the drawer instead (backdrop click or Escape), `closePromoteDrawer` runs directly and resets `promotingIdea` with no promote call — correct either way.

- [ ] **Step 6: Typecheck**

Run: `cd app && npx svelte-check --tsconfig ./tsconfig.json`
Expected: PASS — no errors in the new route files or the modified `GoalDrawer.svelte`.

- [ ] **Step 7: Run the full unit suite**

Run: `cd app && npx vitest run --project server`
Expected: PASS — this task touches no repo/db logic, so nothing here should change.

- [ ] **Step 8: Commit**

```bash
cd app
git add src/routes/ideas src/routes/+layout.svelte src/lib/components/GoalDrawer.svelte
git commit -m "feat: add the Idea Vault page and the Promote-to-Goal flow"
```

---

### Task 7: Goal-side `fromIdea` indicator

**Files:**
- Modify: `app/src/routes/goals/+page.svelte` (goal list card)
- Modify: `app/src/routes/goals/[id]/+page.svelte` (goal detail header)

**Interfaces:**
- Consumes: `GoalSummary.fromIdea`, `GoalDetail.fromIdea` (Task 2); `Icon` component, existing `idea` icon name (`app/src/lib/icons/index.ts`, already shipped — no icon changes needed).

- [ ] **Step 1: Add the indicator to the goal list card**

Edit `app/src/routes/goals/+page.svelte`. Replace:

```svelte
							<div class="min-w-0 flex-1">
								<p class="truncate text-base font-semibold">{goal.title}</p>
```

with:

```svelte
							<div class="min-w-0 flex-1">
								<p class="flex min-w-0 items-center gap-1.5 text-base font-semibold">
									{#if goal.fromIdea}
										<span title="Promoted from an idea" class="shrink-0 text-muted">
											<Icon name="idea" size={13} />
										</span>
									{/if}
									<span class="truncate">{goal.title}</span>
								</p>
```

- [ ] **Step 2: Add the indicator to the goal detail header**

Edit `app/src/routes/goals/[id]/+page.svelte`. Replace:

```svelte
			<h1 class="mt-3.5 mb-2 font-display text-2xl leading-tight font-bold">{goal.title}</h1>
```

with:

```svelte
			<h1 class="mt-3.5 mb-2 flex items-center gap-2 font-display text-2xl leading-tight font-bold">
				{#if goal.fromIdea}
					<span title="Promoted from an idea" class="shrink-0 text-muted">
						<Icon name="idea" size={18} />
					</span>
				{/if}
				{goal.title}
			</h1>
```

- [ ] **Step 3: Typecheck**

Run: `cd app && npx svelte-check --tsconfig ./tsconfig.json`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
cd app
git add src/routes/goals/+page.svelte "src/routes/goals/[id]/+page.svelte"
git commit -m "feat: show an idea-origin indicator on promoted goals"
```

---

### Task 8: Manual verification

No new files. This is a manual pass against the real app — matches the session convention for UI changes, and this feature has no Playwright/component-test coverage available for the same reasons documented in `docs/superpowers/plans/2026-08-03-goal-kanban-view.md`'s Testing Note (no Tauri backend in the Playwright preview build, no `.svelte` component-test harness in this repo).

- [ ] **Step 1: Start the real app**

Run: `cd app && npm run tauri dev`
(Or use the `run` skill if available, which knows this project's launch pattern.)

- [ ] **Step 2: Exercise capture and editing**

- Open **Idea Vault** from the sidebar. Confirm the quick-add bar (title, optional note, tag input) and an empty state.
- Type a title, a note, and two tags separated by commas (typing a comma after each should turn it into a chip); submit. Confirm the idea appears as a card with its title, note preview, and both tag chips.
- Click the idea's edit icon; confirm `IdeaDrawer` opens pre-filled with the title/note/tags, and that pressing Enter while typing a new tag commits it as a chip without submitting the drawer's form.
- Edit the title and save; confirm the card updates.
- Click **New Idea** in the header; confirm a blank drawer opens and creates a second idea.

- [ ] **Step 3: Exercise tag filtering**

- Add a third idea with a tag that overlaps one of the first idea's tags.
- Confirm the tag filter row lists every distinct tag once.
- Click a tag chip; confirm the URL gains `?tag=...` and only ideas carrying that tag (case-insensitively, e.g. typing "CS" vs "cs") remain visible. Click **All** to clear the filter.

- [ ] **Step 4: Exercise the Promote flow**

- Click an idea's promote icon (the goal glyph). Confirm `GoalDrawer` opens in create mode with the title pre-filled from the idea and the description pre-filled from the idea's note.
- Pick a category and timeframe (both required, unchanged from normal goal creation) and save.
- Confirm: the drawer closes, the idea disappears from the Idea Vault list (still filtered to the unpromoted default), and the new goal appears on the Goals page and its detail page both show the `idea` icon next to the title with a "Promoted from an idea" tooltip on hover — and that hovering (not clicking) is the only interaction the icon supports.
- Delete that goal. Confirm the idea reappears in the Idea Vault inbox (the `ON DELETE SET NULL` resurfacing).

- [ ] **Step 5: Exercise deletion and the failure path**

- Delete an idea via its trash icon; confirm the `ConfirmDialog` appears, and the idea is gone after confirming.
- Stop the backend (or force an error) and retry an action (quick-add, edit, delete, or promote); confirm the `actionError`/drawer error banner appears rather than the app crashing.

No commit for this task — it's verification only. If any step fails, fix the underlying task and re-run from Step 1.
