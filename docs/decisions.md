# Architecture decisions

Two choices shape the backend more than any other. Each entry says what was chosen, what the
alternative was, and what would make it worth revisiting. For how the chosen design works, see
the root README (Architecture, and Why data is split between Supabase and Postgres) and
[`auth.md`](auth.md).

## 1. Own API in front of Postgres, rather than Supabase alone

**Chosen:** the browser signs in with Supabase Auth, then calls the Express API (`server/`) with
the access token. The API is the only thing that reads or writes app data and the storage bucket.
Supabase's auto-generated Data API is locked out: the migrations revoke table access from its
`anon` and `authenticated` roles.

**Alternative:** no API server. The SvelteKit app talks to Supabase directly with `supabase-js`
(`from('goals').select()`, storage uploads), and row-level security policies on
`auth.uid()` keep users apart.

| | Own API (chosen) | Supabase only |
| --- | --- | --- |
| Business rules (progress, streaks, grace days, image ownership) | Once, in TypeScript on the server, unit-tested against real Postgres | In the client (every client re-implements them, and users can bypass them) or in Postgres functions |
| Isolation boundary | RLS still, plus a role with `NOBYPASSRLS` and 404 for others' records, swept by `idor.spec.ts` | RLS only; one wrong policy exposes a table to the public Data API |
| Input validation | zod schemas at every route, OpenAPI generated from them | Postgres constraints and checks, or none |
| Rate limits, logging, error shape | In the API (`rateLimit.ts`, `logger.ts`, `AppError`) | Supabase's platform limits and logs |
| Moving off Supabase | Swap the token verifier and image store; app data is plain Postgres | Rewrite every query in every client |
| Cost and effort | A server to build, host and operate (the Kubernetes work) | Nothing to host; the fastest way to ship |
| Client bundle | Small: the app ships only `@supabase/auth-js` | Larger: full `supabase-js` |

**Why:** one place for the rules that matter (streak maths, grace periods, who owns an image),
validation and rate limits the project controls, a clear exit from Supabase, and, stated plainly
in the README, wanting to learn to run a real server on Kubernetes. Supabase-only would be cheaper
and quicker; it lost on control and on that learning goal.

**Revisit if:** hosting the API becomes the main cost or chore and no second client (desktop,
mobile) is coming. Then moving reads to Supabase directly, with the same RLS policies rewritten
on `auth.uid()`, would be the smaller system.

## 2. Supabase-hosted Postgres, rather than self-hosted

**Chosen:** production uses the Postgres that comes with the Supabase project. The schema has no
foreign key into Supabase's `auth` schema (the only link is the `user_id` UUID), so tests and
local development run on a stock `postgres:16` container (`server/docker-compose.yml`).

**Alternative:** run Postgres yourself, either in the Kubernetes cluster (a StatefulSet or an
operator such as CloudNativePG) or as a cloud provider's managed Postgres, and keep Supabase
only for auth and storage.

| | Supabase Postgres (chosen) | Self-hosted in the cluster | Cloud managed Postgres |
| --- | --- | --- | --- |
| Backups and point-in-time recovery | Platform feature (PITR is a paid add-on) | Yours to build and test | Platform feature |
| Upgrades, failover, disk | Supabase | Yours | Provider |
| Latency to the API | Network hop to Supabase's region; pick the region the cluster runs in | Lowest | Low, same cloud |
| Another vendor and bill | No, already using Supabase | No | Yes |
| Learning value | Low | High (operators, storage, failover) | Medium |
| Lock-in | Low: plain SQL migrations, no Supabase-only features | None | Low |

**Why:** the database is the one piece where a mistake loses users' data. Supabase already runs
it, with backups available, at no extra vendor cost, and the app gives up nothing by using it:
the migrations are plain Postgres and run unchanged on the local container. Running stateful
Postgres in a learning cluster would put user data on the least proven part of the stack.

**Revisit if:** the API moves to a cloud region far from Supabase's (latency on every request),
the project outgrows Supabase's plan limits, or running Postgres becomes a learning goal of its
own. The move is a dump and restore plus a new `DATABASE_URL`; nothing in the code changes.

Either way, backups and a tested restore are open items in `TODO.md` (section 8).

## 3. One flat sheet instead of nested cards

**Chosen:** the UI moved from cards inside cards to one flat sheet on a canvas, separated by
hairlines, with dense rows. The reference is a Linear/Plane-style dashboard plus a reports-table
layout. The `mushpoint-design` kit owns the tokens and primitives (`Sheet`, `SectionHeader`,
`Stat`, `Pill`, `Segmented`, `Toolbar`, `Breadcrumb`, `DataTable`, `RowMenu`). The coquette and
nocturne palettes stay, with one new `text-faint` token. The tasks page gained a List view,
now the default. The vision board lost its tilt, polaroid frames, tape and sticky-note colours.
Rounded surfaces with a shadow remain only for dialogs, popovers, drawers and draggable task
cards.

**Alternative:** keep the card layout and restyle it. Rejected: nested borders and shadows made
every screen busy and wasted vertical space on dense lists.

**Pinning:** the app pins the kit by commit on its `feature/flat-redesign` branch until that
branch is merged to the kit's main and the pin is repointed.

**Testing:** e2e was not run locally for this work (it needs the Supabase test project); unit
tests, type check and lint pass, and CI on `dev` runs the e2e suite.

**Revisit if:** dense rows hurt touch use on phones, or the kit branch stays unmerged long
enough that the pin should move to main.
