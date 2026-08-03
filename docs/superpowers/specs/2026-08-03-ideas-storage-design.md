# Phase 5 — Ideas Storage

**Status:** approved 2026-08-03
**Plan reference:** `plans/goal_tracker_plan.md` §5 Feature Breakdown / §5 Build Order, Phase 5
**Depends on:** Phase 1 (Goals/Categories) and Phase 4 (Goal Kanban View), both shipped.

## Goal

A low-friction capture inbox for ideas, with tags for filtering and a "Promote to Goal" action
that hands off into the existing Goal creation flow. No separate Idea Vault beyond the inbox
itself — promoted ideas are hidden, not archived-and-browsable, in this phase.

## Decisions

| Question | Decision |
|---|---|
| Tag model? | Normalized `idea_tags` + `idea_tag_links` join table, not freeform CSV text. |
| How are tags created? | Get-or-create by name on save — no separate tag management screen. |
| What happens to an idea on promote? | Kept, marked via `promoted_goal_id`, hidden from the default inbox list. |
| What if the promoted Goal is later deleted? | `ON DELETE SET NULL` — the idea resurfaces in the inbox automatically. |
| Does promote pre-fill or direct-create the Goal? | Opens the existing `GoalDrawer` pre-filled (title, note → description); category/timeframe still required there, unchanged. |
| Is there a way to browse promoted ideas? | Not in v1 — `includePromoted` exists on the repo `list` function for future use, no UI toggle. |
| Does a promoted Goal show where it came from? | Yes — small `idea` icon next to the Goal title/card when `fromIdea` is true, tooltip only, no click behavior. |
| Is the note markdown-rendered? | No — plain textarea, matching every other free-text field in the app (Goal description, motivation text). |

## 1. Schema — migration 4

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

Appended as `app/src-tauri/migrations/0004_ideas.sql`, entry 4 in the migration set (after
`0003_repo_url.sql`). `idea_tags.name` is unique case-insensitively so "CS" and "cs" get-or-create
to the same row.

`promoted_goal_id IS NULL` is the active-inbox filter. `ON DELETE SET NULL` mirrors the existing
pattern on `goals.category_id` and `tasks.goal_id` — deleting the referenced row un-links rather
than cascades, and here that means a deleted Goal's idea just reappears in the inbox instead of
being silently orphaned or lost.

## 2. API types — `app/src/lib/api/types.ts`

```ts
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

`GoalSummary` and `GoalDetail` each gain `fromIdea: boolean`.

## 3. Repo layer — `app/src/lib/db/repo/idea.ts`

Mirrors the shape of `goal.ts` / `subgoal.ts`.

- `list(driver, { tag, includePromoted }: { tag?: string; includePromoted?: boolean } = {}): Promise<Idea[]>`
  — default `includePromoted = false`; `tag` filters via a join against `idea_tag_links`/`idea_tags`.
- `get(driver, id): Promise<Idea>` — `AppError.notFound('idea', id)` if missing.
- `create(driver, input: IdeaInput): Promise<Idea>` — inserts the idea row, then for each
  `tagNames` entry: get-or-create the `idea_tags` row, insert into `idea_tag_links`.
- `update(driver, id, input: IdeaInput): Promise<Idea>` — updates title/note, then replaces tag
  links wholesale (delete all links for the idea, reinsert from `tagNames`) rather than diffing.
- `remove(driver, id): Promise<void>` — cascade drops its tag links via FK.
- `promote(driver, id, goalId): Promise<Idea>` — sets `promoted_goal_id` and `updated_at`.
- `listTags(driver): Promise<Tag[]>` — every existing tag, for the filter-chip row.

`goal.ts` changes: `list` and `getDetail` add a lookup against `ideas.promoted_goal_id` to
populate `fromIdea` per goal (one extra `LEFT JOIN` or a second query keyed by the goal id set —
implementer's choice, consistent with how `list` already does a per-row lookup for subgoal/task
counts).

Validation: `requiredText('idea title', input.title)`, `optionalText(input.note)`. No new
`AppError` kinds.

## 4. API surface — `app/src/lib/api/index.ts`

```ts
export const listIdeas = async (opts?: { tag?: string; includePromoted?: boolean }): Promise<Idea[]> =>
	ideaRepo.list(await getDriver(), opts);
export const getIdea = async (id: number): Promise<Idea> => ideaRepo.get(await getDriver(), id);
export const createIdea = async (input: IdeaInput): Promise<Idea> => ideaRepo.create(await getDriver(), input);
export const updateIdea = async (id: number, input: IdeaInput): Promise<Idea> =>
	ideaRepo.update(await getDriver(), id, input);
export const deleteIdea = async (id: number): Promise<void> => ideaRepo.remove(await getDriver(), id);
export const promoteIdea = async (id: number, goalId: number): Promise<Idea> =>
	ideaRepo.promote(await getDriver(), id, goalId);
export const listIdeaTags = async (): Promise<Tag[]> => ideaRepo.listTags(await getDriver());
```

## 5. Frontend

**Route.** `app/src/routes/ideas/+page.ts` + `+page.svelte`, same load-then-render shape as
`tasks/+page.ts`.

**Nav.** `+layout.svelte`'s `NAV` array gains `{ href: '/ideas', label: 'Idea Vault', icon: 'idea' }`
— the `idea` icon and the "Idea Vault" label are already reserved by the existing comment there.

**Page layout.**
- Quick-add bar at top: title + optional note + tag input, same low-friction pattern as the Task
  Manager's quick-add.
- Tag filter chip row above the list, sourced from `listIdeaTags`; click toggles the active filter
  (same toggle/chip visual language as `GoalStatusSegment`).
- List of idea cards: title, note preview, tag chips, edit/promote/delete icon buttons — same row
  pattern as `SubgoalCard`/`TaskRow`.

**`IdeaDrawer.svelte`.** New component, same shape as `GoalDrawer`/`TaskDrawer`: title field, note
textarea, tag input (comma-or-enter-separated, resolved to `tagNames: string[]`).

**Promote flow.**
1. Idea card's "Promote" button opens `GoalDrawer`, pre-filled with `title = idea.title`,
   `description = idea.note`. Category/timeframe are left for the user to pick — `GoalDrawer`'s
   existing required-field validation is untouched.
2. On successful save, the caller calls `promoteIdea(ideaId, newGoal.id)`, then closes the drawer.
3. The idea drops out of the default inbox list (`includePromoted` stays `false`) without being
   deleted.

**Goal-side indicator.** Wherever a Goal's title is rendered (goal list card, goal detail header),
show the `idea` icon inline when `fromIdea` is true, with a `title="Promoted from an idea"`
tooltip. No click behavior.

## 6. Testing

- `app/src/lib/db/repo/idea.spec.ts` against `testDriver`/`testSchema`, mirroring
  `goal.spec.ts`/`subgoal.spec.ts`: create with tags, list default excludes promoted, list with
  `includePromoted`, tag filter, promote sets `promoted_goal_id`, promoted Goal deletion resurfaces
  the idea (`ON DELETE SET NULL`), remove cascades tag links, get-or-create tag is case-insensitive.
- `goal.spec.ts` gains cases for `fromIdea` true/false on both `list` and `getDetail`.
- No component-level (`.svelte`) tests — matches current convention; none of the existing
  components (`GoalDrawer`, `TaskDrawer`, `KanbanBoard`, etc.) have specs today.

## Out of scope

- Any screen or toggle to browse already-promoted ideas (the `includePromoted` flag exists in the
  repo for later, unused by the UI this phase).
- Markdown rendering of the note field.
- Tag management (rename/merge/delete a tag) — tags are created implicitly and only ever removed
  by no longer being referenced.
- Editing tags/title/note after an idea is promoted (the drawer still opens; nothing prevents it,
  it's just not a designed flow this phase).
