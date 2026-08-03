# Goal `repo_url` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional `repo_url` field to Goals, with a launch button on the goal detail page, so CS/code-project goals can jump straight to their repo.

**Architecture:** One nullable `TEXT` column on the existing `goals` table (no new table — a single scalar, 1:1 with the goal, per `docs/superpowers/specs/2026-08-02-goal-repo-url-design.md`). Threaded through the existing repo-layer/type/UI pattern that `motivation_text`/`motivation_image_path` already establish.

**Tech Stack:** SvelteKit 5 (runes), TypeScript, `tauri-plugin-sql` (sqlx/SQLite) for the real app, `node:sqlite` in-memory driver for vitest.

## Global Constraints

- No URL format validation (matches how `description`/`motivation_text` are handled — trimmed-to-null, nothing else).
- No new database table — `repo_url` lives directly on `goals`.
- New migration must be registered in `app/src-tauri/src/lib.rs` as version 3, and mirrored verbatim in `app/src/lib/db/testSchema.ts` (the file's own header comment says to keep these in sync).
- Icon set is theme-shared (`ICON_SETS.outline` in `app/src/lib/icons/index.ts`) — add one entry there, not a new set.

---

### Task 1: Schema, types, and repo layer

**Files:**
- Create: `app/src-tauri/migrations/0003_repo_url.sql`
- Modify: `app/src-tauri/src/lib.rs` (register migration version 3)
- Modify: `app/src/lib/db/testSchema.ts` (mirror the new column)
- Modify: `app/src/lib/api/types.ts` (add `repoUrl` to `Goal` and `GoalInput`)
- Modify: `app/src/lib/db/repo/goal.ts` (`COLUMNS`, `GoalRow`, `map()`, `create()`, `update()`)
- Test: `app/src/lib/db/repo/goal.spec.ts`

**Interfaces:**
- Consumes: `optionalText(value: string | null): string | null` from `app/src/lib/db/repo/helpers.ts` (existing).
- Produces: `Goal.repoUrl: string | null`, `GoalInput.repoUrl: string | null` — every later task (drawer, detail page) reads/writes through these two properties.

- [ ] **Step 1: Write the failing tests**

Edit `app/src/lib/db/repo/goal.spec.ts`. Add `repoUrl: null` to the shared `input()` helper (TypeScript will otherwise flag every call site once `GoalInput` gains the field in Step 3 — do this now so Step 1 compiles once the type lands):

```typescript
function input(title: string): GoalInput {
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
```

Add a new test at the end of the `describe('goal', ...)` block, right after the `'creates a goal as active'` test:

```typescript
it('stores and updates the repo URL', async () => {
	const created = await goal.create(driver, {
		...input('Ship v1'),
		repoUrl: 'https://github.com/acme/widget'
	});
	expect(created.repoUrl).toBe('https://github.com/acme/widget');
	expect((await goal.get(driver, created.id)).repoUrl).toBe('https://github.com/acme/widget');

	const updated = await goal.update(driver, created.id, { ...input('Ship v1'), repoUrl: '  ' });
	expect(updated.repoUrl).toBeNull();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd app && npx vitest run src/lib/db/repo/goal.spec.ts`
Expected: FAIL — TypeScript error, `repoUrl` does not exist on type `GoalInput` (the type doesn't have the field yet).

- [ ] **Step 3: Add the migration**

Create `app/src-tauri/migrations/0003_repo_url.sql`:

```sql
ALTER TABLE goals ADD COLUMN repo_url TEXT;
```

- [ ] **Step 4: Register the migration**

Edit `app/src-tauri/src/lib.rs`. Add a third entry to the `migrations()` vec, after the `streaks` one:

```rust
fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "initial",
            sql: include_str!("../migrations/0001_initial.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "streaks",
            sql: include_str!("../migrations/0002_streaks.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "goal_repo_url",
            sql: include_str!("../migrations/0003_repo_url.sql"),
            kind: MigrationKind::Up,
        },
    ]
}
```

- [ ] **Step 5: Mirror the column in the test schema**

Edit `app/src/lib/db/testSchema.ts`. Add `repo_url TEXT,` to the `goals` table definition, right after `motivation_image_path`:

```sql
CREATE TABLE goals (
    id                    INTEGER PRIMARY KEY,
    category_id           INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    title                 TEXT    NOT NULL,
    description           TEXT,
    timeframe             TEXT    NOT NULL CHECK (timeframe IN ('short', 'mid', 'long')),
    status                TEXT    NOT NULL DEFAULT 'active'
                                  CHECK (status IN ('active', 'completed', 'archived')),
    due_date              TEXT,
    motivation_text       TEXT,
    motivation_image_path TEXT,
    repo_url              TEXT,
    created_at            TEXT    NOT NULL,
    updated_at            TEXT    NOT NULL
);
```

Also update the file's header comment (`Mirrors app/src-tauri/migrations/0001_initial.sql + 0002_streaks.sql exactly.`) to read `0001_initial.sql + 0002_streaks.sql + 0003_repo_url.sql`.

- [ ] **Step 6: Add `repoUrl` to the types**

Edit `app/src/lib/api/types.ts`. Add `repoUrl: string | null;` to `Goal` (after `motivationImagePath`) and to `GoalInput` (after `motivationImagePath`):

```typescript
export interface Goal {
	id: number;
	categoryId: number | null;
	title: string;
	description: string | null;
	timeframe: Timeframe;
	status: GoalStatus;
	dueDate: string | null;
	motivationText: string | null;
	motivationImagePath: string | null;
	repoUrl: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface GoalInput {
	categoryId: number | null;
	title: string;
	description: string | null;
	timeframe: Timeframe;
	dueDate: string | null;
	motivationText: string | null;
	motivationImagePath: string | null;
	repoUrl: string | null;
}
```

- [ ] **Step 7: Wire `repo_url` through the repo layer**

Edit `app/src/lib/db/repo/goal.ts`.

`COLUMNS` (add `repo_url` after `motivation_image_path`):

```typescript
const COLUMNS = `id, category_id, title, description, timeframe, status, due_date,
     motivation_text, motivation_image_path, repo_url, created_at, updated_at`;
```

`GoalRow` (add after `motivation_image_path`):

```typescript
interface GoalRow {
	id: number;
	category_id: number | null;
	title: string;
	description: string | null;
	timeframe: Goal['timeframe'];
	status: GoalStatus;
	due_date: string | null;
	motivation_text: string | null;
	motivation_image_path: string | null;
	repo_url: string | null;
	created_at: string;
	updated_at: string;
}
```

`map()` (add after `motivationImagePath`):

```typescript
function map(row: GoalRow): Goal {
	return {
		id: row.id,
		categoryId: row.category_id,
		title: row.title,
		description: row.description,
		timeframe: row.timeframe,
		status: row.status,
		dueDate: row.due_date,
		motivationText: row.motivation_text,
		motivationImagePath: row.motivation_image_path,
		repoUrl: row.repo_url,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}
```

`create()` — add `repo_url` to the column list and a bound parameter:

```typescript
export async function create(driver: SqlDriver, input: GoalInput): Promise<Goal> {
	const title = requiredText('goal title', input.title);
	if (input.categoryId !== null) {
		await category.get(driver, input.categoryId);
	}
	const timestamp = now();

	const result = await driver.execute(
		`INSERT INTO goals (category_id, title, description, timeframe, status, due_date,
                            motivation_text, motivation_image_path, repo_url, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, 'active', ?5, ?6, ?7, ?8, ?9, ?9)`,
		[
			input.categoryId,
			title,
			optionalText(input.description),
			input.timeframe,
			optionalText(input.dueDate),
			optionalText(input.motivationText),
			optionalText(input.motivationImagePath),
			optionalText(input.repoUrl),
			timestamp
		]
	);

	return get(driver, result.lastInsertId);
}
```

`update()` — add `repo_url` to the `SET` clause and a bound parameter, shifting the trailing `updated_at`/`id` placeholders up by one:

```typescript
export async function update(driver: SqlDriver, id: number, input: GoalInput): Promise<Goal> {
	const title = requiredText('goal title', input.title);
	if (input.categoryId !== null) {
		await category.get(driver, input.categoryId);
	}

	const result = await driver.execute(
		`UPDATE goals
         SET category_id = ?1, title = ?2, description = ?3, timeframe = ?4, due_date = ?5,
             motivation_text = ?6, motivation_image_path = ?7, repo_url = ?8, updated_at = ?9
         WHERE id = ?10`,
		[
			input.categoryId,
			title,
			optionalText(input.description),
			input.timeframe,
			optionalText(input.dueDate),
			optionalText(input.motivationText),
			optionalText(input.motivationImagePath),
			optionalText(input.repoUrl),
			now(),
			id
		]
	);

	if (result.rowsAffected === 0) throw AppError.notFound('goal', id);
	return get(driver, id);
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `cd app && npx vitest run src/lib/db/repo/goal.spec.ts`
Expected: PASS — all tests in the file, including the new `'stores and updates the repo URL'` test.

- [ ] **Step 9: Run the full unit suite and type check**

Run: `cd app && npm run test:unit -- --run && npm run check`
Expected: PASS — confirms no other file references the now-two-field-longer `GoalInput`/`Goal` shape incompletely (e.g. any other object literal typed as `GoalInput`).

- [ ] **Step 10: Commit**

```bash
cd app
git add src-tauri/migrations/0003_repo_url.sql src-tauri/src/lib.rs src/lib/db/testSchema.ts src/lib/api/types.ts src/lib/db/repo/goal.ts src/lib/db/repo/goal.spec.ts
git commit -m "feat: add repo_url column to goals"
```

---

### Task 2: UI — drawer field, icon, and launch button

**Files:**
- Modify: `app/src/lib/icons/index.ts` (add `github` icon)
- Modify: `app/src/lib/components/GoalDrawer.svelte` (form field)
- Modify: `app/src/routes/goals/[id]/+page.svelte` (launch button)

**Interfaces:**
- Consumes: `Goal.repoUrl: string | null`, `GoalInput.repoUrl: string | null` (Task 1). `Icon` component's `name: IconName` prop (`app/src/lib/components/Icon.svelte`, existing). `button.icon` class string (`app/src/lib/components/ui.ts`, existing).
- Produces: `IconName` gains `'github'`; no other task depends on this task's output.

- [ ] **Step 1: Add the `github` icon**

Edit `app/src/lib/icons/index.ts`. Add `'github'` to the `IconName` union (after `'chevron-right'`):

```typescript
export type IconName =
	| 'dashboard'
	| 'goal'
	| 'project'
	| 'task'
	| 'idea'
	| 'vision'
	| 'settings'
	| 'plus'
	| 'minus'
	| 'check'
	| 'edit'
	| 'trash'
	| 'close'
	| 'calendar'
	| 'flame'
	| 'warning'
	| 'spinner'
	| 'sidebar'
	| 'chevron-down'
	| 'chevron-right'
	| 'github';
```

Add the glyph to the `outline` set (after `'chevron-right'`). The rest of the set is stroke-only (`fill="none"` on the outer `<svg>`, set by `Icon.svelte`), but the GitHub mark is a solid silhouette — same override `'goal'` already uses for its center dot (`fill="currentColor" stroke="none"`), here wrapping the whole mark and scaled from its native 16x16 path data up to the shared 24x24 viewBox:

```typescript
	github: `<g fill="currentColor" stroke="none" transform="scale(1.5)"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></g>`
```

- [ ] **Step 2: Add the repo URL field to `GoalDrawer.svelte`**

Edit `app/src/lib/components/GoalDrawer.svelte`.

Add `repoUrl: ''` to the `form` state object:

```typescript
	let form = $state({
		title: '',
		categoryId: '',
		timeframe: 'short' as Timeframe,
		motivationText: '',
		description: '',
		dueDate: '',
		repoUrl: ''
	});
```

Add `repoUrl: goal?.repoUrl ?? ''` to the `$effect` that resets the form:

```typescript
	$effect(() => {
		if (!open) return;
		error = null;
		titleMissing = false;
		form = {
			title: goal?.title ?? '',
			categoryId: goal?.categoryId ? String(goal.categoryId) : '',
			timeframe: goal?.timeframe ?? 'short',
			motivationText: goal?.motivationText ?? '',
			description: goal?.description ?? '',
			dueDate: goal?.dueDate ?? '',
			repoUrl: goal?.repoUrl ?? ''
		};
	});
```

Add `repoUrl: form.repoUrl.trim() || null` to the `input` object built in `submit()`:

```typescript
		const input = {
			categoryId: form.categoryId ? Number(form.categoryId) : null,
			title: form.title.trim(),
			description: form.description.trim() || null,
			timeframe: form.timeframe,
			dueDate: form.dueDate || null,
			motivationText: form.motivationText.trim() || null,
			motivationImagePath: goal?.motivationImagePath ?? null,
			repoUrl: form.repoUrl.trim() || null
		};
```

Add the field to the template, after the Description field and before the Due date field:

```svelte
	<div>
		<label class={field.label} for="goal-repo">Repository URL (optional)</label>
		<input
			id="goal-repo"
			type="text"
			class={field.input}
			bind:value={form.repoUrl}
			placeholder="https://github.com/you/project"
		/>
	</div>
```

- [ ] **Step 3: Add the launch button to the goal detail page**

Edit `app/src/routes/goals/[id]/+page.svelte`. In the top card's action row (the `div.flex.shrink-0.gap-1` holding edit/trash), add the repo link before the edit button, shown only when `goal.repoUrl` is set:

```svelte
				<div class="flex shrink-0 gap-1">
					{#if goal.repoUrl}
						<a
							href={goal.repoUrl}
							target="_blank"
							rel="noopener noreferrer"
							class={button.icon}
						>
							<Icon name="github" size={14} label="Open repository" />
						</a>
					{/if}
					<button type="button" class={button.icon} onclick={() => (editing = true)}>
						<Icon name="edit" size={14} label="Edit goal" />
					</button>
					<button
						type="button"
						class={button.icon}
						disabled={busy}
						onclick={() => (confirmingDelete = true)}
					>
						<Icon name="trash" size={14} label="Delete goal" />
					</button>
				</div>
```

- [ ] **Step 4: Type-check**

Run: `cd app && npm run check`
Expected: PASS — no type errors from the new field/prop usage.

- [ ] **Step 5: Manual verification**

Run: `cd app && npm run tauri dev`

1. Open a goal, click Edit, confirm the "Repository URL (optional)" field appears after Description.
2. Type `https://github.com/acme/widget`, save. Confirm a GitHub icon button now appears in the top card's action row, left of Edit.
3. Click it — confirm it opens `https://github.com/acme/widget` in the system browser (not in-app) and the app window itself does not navigate away.
4. Edit the goal again, clear the field, save. Confirm the GitHub icon button disappears.
5. Create a brand-new goal without setting a repo URL. Confirm no GitHub icon button appears on its detail page.

- [ ] **Step 6: Commit**

```bash
cd app
git add src/lib/icons/index.ts src/lib/components/GoalDrawer.svelte src/routes/goals/[id]/+page.svelte
git commit -m "feat: add repo launch button to goal detail page"
```
