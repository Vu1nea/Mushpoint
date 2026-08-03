# Goal `repo_url` — Design

## Goal

Let a Goal optionally carry a repository URL (GitHub/GitLab/etc.) with a launch
button on its detail page, so CS/code-project goals can jump straight to their
repo. Field lives on `goals` directly — no separate repos/projects table (see
"Architectural & Design Notes" in `docs/plans/goal_tracker_plan.md`: a single
scalar, 1:1 with the goal, doesn't earn its own table).

## Schema

New migration `app/src-tauri/migrations/0003_repo_url.sql`:

```sql
ALTER TABLE goals ADD COLUMN repo_url TEXT;
```

Nullable, no format constraint — same as `motivation_text`. `testSchema.ts`
(the in-memory test driver's schema) gets the matching column.

## Types (`app/src/lib/api/types.ts`)

Add `repoUrl: string | null` to `Goal` and `GoalInput`.

## Repo layer (`app/src/lib/db/repo/goal.ts`)

Mirrors the existing `motivation_image_path` handling exactly:

- `COLUMNS` — add `repo_url`
- `GoalRow` — add `repo_url: string | null`
- `map()` — add `repoUrl: row.repo_url`
- `create()` — insert `optionalText(input.repoUrl)`
- `update()` — set `repo_url = optionalText(input.repoUrl)`

## UI — `GoalDrawer.svelte`

New optional text input, "Repository URL (optional)", placed after
Description. Trimmed-to-null on submit like the other optional text fields.
No client-side URL format validation.

## Icon (`app/src/lib/icons/index.ts`)

Add `'github'` to `IconName` and a matching mark-only glyph (outline set,
`currentColor`, consistent stroke weight with the rest of the set).

## Goal detail page (`app/src/routes/goals/[id]/+page.svelte`)

New icon button in the top card's action row, next to edit/trash, rendered
only when `goal.repoUrl` is set:

```svelte
{#if goal.repoUrl}
	<a href={goal.repoUrl} target="_blank" rel="noopener noreferrer" class={button.icon}>
		<Icon name="github" size={14} label="Open repository" />
	</a>
{/if}
```

## Tests

Extend `goal.spec.ts`: create/update/map round-trip coverage for `repoUrl`,
following the existing pattern for every other column.

## Out of scope

- URL format validation
- Multiple repos per goal
- Repo metadata (branch, stars, CI status)
