# Mushpoint

Goal tracker web client: SvelteKit (static SPA) + Tailwind v4. All data lives behind the
Mushpoint API in [`../server`](../server/README.md); this app only talks to it over HTTP.
Plan of record: [`../plans/goal_tracker_plan.md`](../plans/goal_tracker_plan.md).

The last desktop (Tauri + SQLite) version is tagged `desktop-sqlite-final`.

## Running it

1. Copy `static/config.example.json` to `static/config.json` (gitignored) and fill in
   your Supabase project URL and anon key. Leave `apiUrl` as `/api`.
2. Start the API server as described in [`../server/README.md`](../server/README.md). It
   listens on `localhost:3000`; the Vite dev server proxies `/api` to it.
3. Start the client:

```sh
npm install
npm run dev
```

## Tests

```sh
npm run test:unit     # vitest — pure client logic and the API client (HTTP mocked)
npm run test:e2e      # playwright
npm run test          # unit tests, run once
npm run check         # svelte-check
```

## Layout

```
src/lib/api/          the one interface routes/components use; one HTTP call per function
src/lib/images.ts     vision image upload (type/size checked before it is sent)
src/lib/theme/        active theme store, persisted via the API and mirrored to localStorage
src/lib/icons/        logical icon names resolved per theme
src/lib/components/   UI components
src/routes/           one folder per screen
static/config.json    runtime config (API base URL, Supabase project), loaded at startup
```

## Things worth knowing

- **Progress is derived, never stored.** A goal averages its direct children —
  subgoals and directly-linked tasks weigh the same, and a subgoal's own value is
  the average of its tasks. Tasks count only when `done`; `in_progress` is 0.
- **Status is not progress.** Completing or archiving a goal is an explicit user
  action, so progress can sit at 100% while the goal stays active.
- **Images** are uploaded to the server, which stores them and returns a short-lived
  signed URL; the server also removes an image when its vision item drops or
  replaces it, so the client never deletes files.
- **Themes** are CSS custom properties from `mushpoint-design/css/theme.css`
  (imported in `src/routes/layout.css`) mapped to Tailwind utilities (`bg-surface`,
  `text-muted`, …). Adding a theme means adding it to the design package, one entry in
  `THEMES` (`src/lib/theme/theme.svelte.ts`), and one in the server's allow-list.
  Components must not hardcode colors.
