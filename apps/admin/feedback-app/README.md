# Driver Feedback App

Part of the **Admin Team Portal**, Phase 1 (`apps/admin/feedback-app`). Employees and
guests rate their trip with an in-house driver: log in, pick a driver from a grid, submit
a date + 1–5 rating + optional description.

This file is the full reference — stack, architecture, database, what to touch and what
not to. For the shorter "what's live and what broke while building it" version, see
[`AGENTS.md`](./AGENTS.md) in this same folder.

---

## Status

**Phase 1 (this app) is functionally complete and live-tested** against the real Supabase
project. **`apps/admin/internal-portal` is a real, fully-built app** (cars, drivers,
journeys, a dashboard, an admin auth gate — see its own README) — not a Phase 2
placeholder, whatever an older version of this doc claimed.

Not done within Phase 1 itself:
- No admin UI for managing drivers, vehicles, or photos in *this* app — that's
  `internal-portal`'s job. Everything currently in `drivers`/`vehicles` was inserted
  directly via SQL migrations.
- No driver photos uploaded yet — the grid shows initials as a fallback.
- No `roles`/`role_permissions` seeded (team-members module) — irrelevant to this app
  specifically right now, since neither login path is Supabase Auth or permission-gated
  (see below); relevant only if this app ever needs role-based restriction of its own.

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 16 (App Router, Turbopack) | `middleware.ts` is deprecated in this version — this app uses `proxy.ts` |
| UI | React 19 + Hero UI **v3** (`@heroui/react`, `@heroui/styles`) | v3, not v2 — compound components, no `<Provider>`, CSS-first styling |
| Styling | Tailwind CSS v4 | CSS-first (`@import` + `@source` in `app/globals.css`), no `tailwind.config.js` |
| Database + Auth | Supabase (project `matnispbauvvlnbsuzxq`) | One shared project across the whole org — see root `AGENTS.md` |
| Writes | Supabase Edge Functions (`supabase/functions/*`) | Called via `packages/db-management-client`; no direct client writes anywhere |
| Object storage | Public Supabase Storage bucket (`driver-photos`) | **Deliberate override** of the org default (self-hosted S3) — see root `AGENTS.md` §1 |
| Shared packages | `@jaipur-rugs/{auth,ui-kit,supabase-client,db-management-client,config}` | Workspace packages, consumed as TS source (no build step) |

## Local development

```bash
pnpm install                              # from repo root
pnpm --filter feedback-app type-check     # should be clean
pnpm --filter feedback-app dev            # http://localhost:3000
```

Required env (`.env.local`, see `.env.example`):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_ROOT_DOMAIN=     # leave empty in local dev
```

No S3 config needed — driver photos resolve directly against
`NEXT_PUBLIC_SUPABASE_URL`'s Storage endpoint (`lib/env.ts`).

## Architecture

### Two login paths, neither is Supabase Auth

- **Employee** — `employee_code` + phone number, matched against the `employees` table via
  the `employee-signin` edge function. Phone matching is digit-normalized on the last 10
  digits (`employees.phone` has no enforced format, unlike guests), and the form uses a
  plain phone field with no country-code picker. This used to be real Supabase Auth
  (`signInWithPassword`) — replaced mid-build. See `db/MIGRATIONS.md`'s "Employee login
  redesign" entry for the full reasoning.
- **Guest** — matched against (or inserted into) `guests` by phone via `guest-signup`, full
  E.164 with a mandatory country-code picker. This was a deliberate mid-build product
  decision — guests are tracked data for the purpose of the feedback record, not accounts.
  See `db/MIGRATIONS.md`'s "Guest tracking redesign" entry.

Neither path creates an `auth.users` row or a session. Both return only an id, which the
browser remembers in a plain, non-httpOnly cookie (`jr_employee_id` / `jr_guest_id`,
consolidated in `lib/authCookies.ts` — replaces the old single-purpose `lib/guestCookie.ts`).

`proxy.ts` (Next 16's renamed `middleware.ts`) is the single access gate, and it's now
purely cookie-based: lets a request through if it carries *either* `jr_employee_id` *or*
`jr_guest_id`. There is no Supabase session check anywhere in this app anymore. There's no
Hub app yet to redirect unauthenticated users to, so they land on this app's own `/login`.

### Reads vs. writes

- **Reads** go straight through the shared read-only Supabase client
  (`@jaipur-rugs/supabase-client` / `lib/supabaseClient.{browser,server}.ts`), RLS-scoped.
  The driver grid is a Server Component doing exactly this — no edge function involved.
- **Writes** always go through `supabase/functions/*`, called via
  `@jaipur-rugs/db-management-client` — never a direct `.insert()`/`.update()` from any
  app. This is an org-wide rule (root `AGENTS.md` §4/§9), not specific to this app.

| Function | Auth required | Does |
|---|---|---|
| `guest-signup` | None (bootstrap step) | Phone match-or-create against `guests`. Returns `{guestId, matched}`. |
| `employee-signin` | None (bootstrap step) | `employee_code` + phone match against `employees` (last-10-digits, case-insensitive code). Returns `{employeeId}`. |
| `submit-feedback` | `guestId` **or** `employeeId` in body — exactly one | Validates driver/rating/date, inserts one `feedback` row. |

### Styling

Hero UI v3 ships component CSS as a **precompiled package you `@import`**
(`@import "@heroui/styles";` in `app/globals.css`) — not JS theme files that Tailwind has
to scan, which is how v2 worked. There is deliberately no `tailwind.config.js`; Tailwind
v4's own auto content-detection covers this app's files, and `@source` in `globals.css`
adds the one path outside this app's tree that also needs scanning
(`packages/ui-kit/src`). Color tokens are v3's (`accent`, `muted`, `surface`, `default`,
`danger`, ...) — not v2's (`primary`, `default-500`, etc.).

## Database

Full ERD: [`db/feedback/feedback-schema.mmd`](../../../db/feedback/feedback-schema.mmd).
Full migration history (every module, every project): [`db/MIGRATIONS.md`](../../../db/MIGRATIONS.md).
This section is a summary, not the source of truth — if it and the ERD/ledger ever
disagree, they win.

### Tables

| Table | Purpose | Key points |
|---|---|---|
| `drivers` | The 13 in-house drivers | `anon`-readable (guests browse with no session) but **only via a column-level GRANT** — `phone`/`department_id` are `authenticated`-only even though the RLS policy itself doesn't restrict columns. Independent of `employees` (not every driver is a full HR record). |
| `vehicles` | 14-vehicle fleet roster | Independent of `drivers` — the two source lists don't map 1:1 and no assignment was given. `authenticated`-only, no anon access (nothing guest-facing needs it yet). |
| `guests` | Phone-matched tracking data, **not** Supabase Auth users | No SELECT policy for any client role at all — written and read only by the service-role edge functions. |
| `feedback` | One row per submitted rating | Exactly one of `employee_id`, `guest_id`, or the now-vestigial `reviewer_auth_user_id` is set, enforced by a 3-way CHECK constraint (`feedback_reviewer_exactly_one`). No client INSERT policy — `submit-feedback` is the only write path. `reviewer_auth_user_id` is kept in the schema for any future real-session integration but is no longer populated by this app. |

### Migrations applied so far (feedback module)

| File | What it did |
|---|---|
| `001_feedback_schema.sql` | Initial `drivers`/`guests`/`feedback` schema + RLS |
| `002_advisor_fixes.sql` | Fixed Supabase advisor findings (per-row `auth.uid()` re-evaluation) |
| `003_guest_tracking_only.sql` | Redesigned guests to pure data entry (dropped `guests.auth_user_id`, added `feedback.guest_id`, made `reviewer_auth_user_id` nullable) |
| `004_seed_drivers_and_vehicles.sql` | Created `vehicles`, seeded 13 real drivers + 14 real vehicles, tightened `drivers`' anon column grant before inserting real phone numbers |
| `005_create_driver_photos_bucket.sql` | Created the public `driver-photos` Storage bucket |
| `006_employee_code_phone_login.sql` | Redesigned employee login away from Supabase Auth to `employee_code` + phone matching (mirrors 003's guest redesign). Added `feedback.employee_id`, replaced the 2-way `feedback_reviewer_xor_guest` CHECK with the 3-way `feedback_reviewer_exactly_one`. |

A parallel, unrelated fix also landed in the `team-members` module during this work:
`003_drop_stale_auth_trigger.sql` removed orphaned debris (a trigger from a previous,
superseded schema on this same project) that was breaking all new-user creation. See
`db/MIGRATIONS.md` for the full story, including why this project's migration history has
entries that don't correspond to anything in this repo (a different app's schema
predates this one and was deliberately dropped).

## What to touch, what not to touch

**Safe / expected to touch:**
- `app/`, `components/`, `lib/` — normal app code.
- `db/feedback/*.sql` — add a new numbered migration for schema changes; never edit an
  already-applied one in place (see root `AGENTS.md` §3.1).
- `supabase/functions/{guest-signup,employee-signin,submit-feedback}` — but redeploy after editing
  (`mcp Supabase deploy_edge_function` or `supabase functions deploy`), and update
  `packages/db-management-client` if the request/response shape changes.

**Don't touch without a real reason, and update docs if you do:**
- `packages/supabase-client/src/types.ts` — generated output (`generate_typescript_types`),
  never hand-edited. Regenerate after every schema migration.
- `lib/env.ts` — every `NEXT_PUBLIC_*` reference must stay a static property access (see
  `AGENTS.md`'s gotchas section). Don't refactor into a dynamic `requireEnv(name)` helper.
- `lib/supabaseClient.browser.ts` / `lib/supabaseClient.server.ts` — kept as two files on
  purpose (`next/headers` can't be bundled into client code at all). Don't merge them.
- `proxy.ts` — this app's only access gate. Don't add a `middleware.ts` back.
- `tailwind.config.js` — intentionally doesn't exist (Tailwind v4 is CSS-first). Don't
  recreate one; add `@source`/`@theme` to `app/globals.css` instead.
- The `driver-photos` Storage bucket / object storage choice — this is a recorded,
  deliberate override of the org's default (root `AGENTS.md` §1). Don't treat it as
  precedent for a different module without the same explicit conversation.
- `db/MIGRATIONS.md` — the cross-module source of truth for what's actually been applied
  to the live project. A `.sql` file existing in the repo is not proof it was ever run;
  this file is. Update it whenever you apply a migration.

## Related docs

- Root [`AGENTS.md`](../../../AGENTS.md) — org-wide conventions, tech stack, RLS/write-path rules.
- [`db/MIGRATIONS.md`](../../../db/MIGRATIONS.md) — full migration ledger, every module.
- [`db/feedback/feedback-schema.mmd`](../../../db/feedback/feedback-schema.mmd) — ERD.
- [`db/team-members/team-members-schema.mmd`](../../../db/team-members/team-members-schema.mmd) — the org/RBAC schema this app builds on top of for employee identity.
