# AGENTS.md — jaipur-rugs Monorepo

**Audience:** any coding agent (Claude Code, Codex, Cursor, etc.) or human working in this repo.
**Scope:** this file governs how the `jaipur-rugs` monorepo is planned, built, and maintained. It sits alongside — and does not replace — `jaipur-rugs-monorepo-plan.md` (architecture rationale) and `architecture.md` / `03-DB-Usage-Guide-Frontend.md` (module tracker + frontend DB usage rules) once those exist in-repo.

This document describes **how to execute**, not just what the target looks like. When in doubt, re-read Section 4 (DB planning) and Section 8 (Do/Don't) before writing code or a migration.

---

## 1. Tech Stack (fixed — do not substitute)

| Layer | Choice |
|---|---|
| Frontend framework | Next.js (App Router) |
| Runtime / backend services | Node.js |
| Database + Auth | **Supabase** — one project, shared by every app |
| Object storage | Self-hosted S3 (not Supabase Storage) — **except** `apps/admin/feedback-app`'s driver photos, see note below |
| UI component library | Hero UI |
| Charts | Bklit |
| Language | TypeScript everywhere (apps and packages) |
| Package/build tooling | pnpm workspaces + Turborepo |
| Hosting | Vercel — one project per app |

Do not introduce a second UI kit, a second charting library, a second ORM, or a second database engine "just for one module." The whole point of this architecture is that every department app looks, authenticates, and queries the same way. If a module has a real technical reason it can't use the shared stack, that's an escalation to discuss — not a silent local decision.

**Recorded override (2026-08-18):** the Feedback App's driver photos (`drivers.photo_path`) use a public Supabase Storage bucket (`driver-photos`), not self-hosted S3 — a deliberate, discussed decision, not a silent one. This is scoped to that one use case; don't treat it as license to default new modules to Supabase Storage without the same explicit conversation. See `db/feedback/005_create_driver_photos_bucket.sql` and `lib/env.ts` in `apps/admin/feedback-app`.

**Recorded override (2026-08-19):** Hub's employee avatars (`employees.avatar_path`) use a public Supabase Storage bucket (`employee-avatars`), same rationale and same one-off scope as the driver-photos override above — not a general license for future modules. See `db/team-members/006_hub_onboarding_and_admin.sql` and `lib/env.ts` in `apps/hub`.

**Recorded override (2026-08-22):** `apps/atlas`'s external/merchant login uses **Clerk**, not Supabase Auth — a deliberate, discussed decision (not a silent one; the user explicitly chose it over the two Supabase-native options originally proposed — a lightweight cookie-identify flow or Supabase Auth magic link). Internal staff on Atlas still use the exact same Supabase Auth pattern as every other app; Clerk is scoped to the `/merchant/*` route tree only and is **not** promoted into `packages/auth` (Section 4 — a shared package change needs more than one app's need; no other app has an external audience yet). RLS recognizes a Clerk session via Supabase's Third-Party Auth integration (a one-time Dashboard configuration — Authentication → Third-Party Auth → Clerk — not something a migration can do; see `db/orders/README.md`). `merchants.clerk_user_id` is the join key, set only by `supabase/functions/merchants-link-clerk-account`, which verifies the Clerk session token itself via `@clerk/backend` rather than depending on that Dashboard integration being configured. If a second app ever needs external/customer auth, that's the point to revisit whether Clerk support belongs in `packages/auth` instead of being re-added per-app.

**Recorded override (2026-08-22):** `packages/ui-kit` gained a small `react-bits`-pattern motion layer (`CountUp`, `StageTimeline`) for `apps/atlas`'s dashboard totals and per-order stage timeline, per Section 1.1's own recommendation — confirmed with the user before adding `framer-motion` as a dependency. These are **first-party implementations matching react-bits' visual patterns, not vendored react-bits source** — the build pass that added them had no way to pull and audit that source directly (`jsrepo`, the CLI react-bits distributes through, needs an interactive session). Whoever wants the literal upstream components should treat this as a from-scratch replacement, not an upgrade path.

---

## 2. Repo Layout (target state)

```
jaipur-rugs/
├── apps/
│   ├── hub/                    # common interface — auth, org directory, hierarchy, role admin, launcher
│   ├── admin/                   # grouping folder — one department, two independently deployed apps
│   │   ├── feedback-app/        # Vercel — employees/guests rate in-house drivers (Phase 1)
│   │   └── internal-portal/     # on-premise — driver mgmt, reporting (Phase 2, placeholder only)
│   ├── atlas/                    # cross-functional — merchant/production/shipping/sales order visibility (see db/orders/)
│   ├── inventory/               # department app, added when its DB module ships
│   ├── production/
│   └── ...
├── packages/
│   ├── ui-kit/                  # Hero UI wrappers + shared design tokens
│   ├── charts/                  # Bklit chart configs
│   ├── supabase-client/         # read-only client + generated types (generated FROM the live schema)
│   ├── auth/                    # shared session/cookie logic, cross-app SSO helpers
│   ├── db-management-client/    # typed wrapper every app uses to call db-management (Section 4)
│   └── config/                  # shared eslint/tsconfig/tailwind config
├── db/                          # migrations + ERDs, one subfolder per module (source of truth for schema)
├── supabase/
│   └── functions/                # db-management, implemented as Supabase Edge Functions (Section 4)
├── turbo.json
└── pnpm-workspace.yaml
```

There is no `apps/team-members` — that functionality lives inside `apps/hub` (Section 3 of the monorepo plan). Do not recreate it as a standalone app later without a deliberate decision to reverse that call.

`apps/admin/` is the one exception to the flat `apps/<name>` rule: one department, two apps deployed separately (Vercel + on-premise), grouped under a shared folder for discoverability. Don't extend this nesting pattern to other departments without a deliberate reason — it exists here because admin genuinely ships two apps, not as a new default.

---

## 3. The Database Is Singular — Plan Accordingly

There is **one** Supabase project for the entire org (currently `matnispbauvvlnbsuzxq` — verify against the live target before running any migration; do not assume a project by name alone, since names can be misleading here). Every department module is a set of tables *in that same database*, not a database of its own.

Consequences of "one massive DB":

- **Cross-module joins are a first-class capability, not a workaround.** Inventory tables reference `employees.id` directly; production tables reference `departments.id` directly. You are not building microservice-style siloed schemas — you are building one relational model that happens to be exposed through several frontends.
- **Namespacing is by naming convention, not by app.** A table belongs to the domain that owns it (`employees`, `departments` → Team Members / Hub; future `inventory_items`, `production_batches` → their modules), but there is no per-app schema isolation in Postgres. Assume any table is readable (subject to RLS) from any app.
- **RLS is the only access boundary.** Because every app shares one DB and one anon key shape, a department app does not get its own restricted credentials — it gets the same kind of Supabase client as every other app, scoped only by Row Level Security policies tied to the authenticated user's role/department. If a new module's data must not leak to unauthorized roles, that is enforced by writing correct RLS policies, never by giving that app a different connection.
- **One migration history.** All schema changes across all modules land in the same Supabase migration timeline. A migration for `inventory` can depend on `employees` already existing — sequence migrations accordingly, and never assume module isolation lets you skip checking for foreign-key conflicts with tables you didn't write.

### 3.1 Precise DB Planning Process (per module)

Follow this sequence for every new module (this is what "planning the DB precisely" means in practice):

1. **Define the entities and their real-world relationships first, in plain language**, before touching SQL. What does this module track, and which existing tables (`employees`, `departments`, `roles`) does it hang off of?
2. **Draw the ERD as a Mermaid `erDiagram`** (see `team-members-schema.mmd` as the reference format/style) and get it reviewed before generating migrations. This is the artifact that should live in `db/<module>/`.
3. **Follow the established naming/typing conventions** (derived from the Team Members foundation, keep consistent):
   - `uuid` primary keys named `id`.
   - Foreign keys named `<referenced_entity>_id` (e.g. `department_id`, `manager_id`, `granted_by`).
   - `timestamptz created_at` (and `updated_at` where rows mutate) on every table.
   - Status/category fields as Postgres `enum` types, not free-text strings.
   - Junction/assignment tables (`employee_roles`, `department_access_grants`) for many-to-many or time-bound relationships — don't bolt a second FK column onto an existing table when a real many-to-many exists.
   - Self-referencing hierarchy via nullable FK (`manager_id`, `parent_department_id`), not a separate closure table, unless query performance proves otherwise.
4. **Design RLS policies alongside the schema, not after.** For every table, know before writing the migration: who can `SELECT`, who can `INSERT`/`UPDATE`, and whether that's row-scoped by department, by role, or by a hierarchy walk (e.g. "a manager can see their reports' rows").
5. **Run the migration through Supabase, then immediately check advisors** (security + performance linters) before considering the migration done — the existing foundation schema had a follow-up "fix advisor findings" migration; treat that check as a required step, not a cleanup afterthought.
6. **Regenerate `packages/supabase-client` types** after any schema change lands, so every app's TypeScript types stay truthful. A stale generated-types package is worse than no types — it will silently lie about columns that were renamed or dropped.
7. **Update the Module Tracker** (`architecture.md`) with the new module's status and which frontend app consumes it, and re-run the DB scoring matrix if the new module changes build-order priority for what ships next.
8. **Only after the schema + RLS + types are settled** does the corresponding `apps/<module>` frontend get scaffolded (or, for Team Members, `apps/hub` gets extended).

Do not write frontend code against a schema that hasn't had its RLS policies defined — "I'll add RLS later" is how the read-only-client/RLS-as-the-real-gate model breaks.

---

## 4. Shared Packages Contract

- `packages/ui-kit`, `packages/charts`, `packages/auth`, `packages/config`, `packages/supabase-client`, `packages/db-management-client` are consumed by every app. Treat changes here as **public API changes across the whole org**, not local edits.
- A change to a shared package should be justified by more than one app's need, or it belongs in that one app instead. Don't preemptively generalize a hub-only component into `ui-kit` just because "it might be reused."
- Because Turborepo rebuilds every dependent app when a shared package changes, a breaking change in `packages/auth` or `packages/supabase-client` is a breaking change everywhere, simultaneously. Version/communicate accordingly — don't land a shared-package change and walk away without checking what else it touched.
- `packages/supabase-client` is **read-only** by contract (per `03-DB-Usage-Guide-Frontend.md`). Writes go through the `db-management` API, from every app, including the Hub's admin UI. There is no "trusted app" exception.
- **`db-management` is implemented as Supabase Edge Functions**, under `supabase/functions/` — one function per write capability (e.g. `guest-signup`, `submit-feedback`), named `<module>-<action>`. This is the answer to the open question this doc used to leave unstated ("its own tech stack, repo location, and deployment target are never stated"): every app already talks to the one shared Supabase project, so a new write capability is one more function, not a new Vercel project. Every app calls these through `packages/db-management-client` rather than hand-rolling `supabase.functions.invoke(...)` calls per app.

---

## 5. Independent Per-App Deployment

- Each app in `apps/` is its own Vercel project, its own subdomain (`os.jaipurrugs.com`, `inventory.jaipurrugs.com`, ...), its own environment variables.
- Session sharing across subdomains is handled by `packages/auth` setting the Supabase Auth cookie with `domain: .jaipurrugs.com` — this logic must not be reimplemented per-app. If an app needs custom session behavior, that's a signal to extend `packages/auth`, not to fork it.
- A shared session proves "logged in," never "authorized for this app." Every app independently re-verifies the user's role/department access via RLS-scoped queries on load, and redirects unauthorized users back to the Hub launcher rather than rendering a broken or empty page.
- No app, including Hub, ever holds a Supabase **service-role key**. If a task seems to require one client-side or in an app's server code, that's a design error — route the write through `db-management` instead.

---

## 6. Build Order

1. `packages/*` — even minimal/stub versions of `ui-kit`, `auth`, `supabase-client`, `config` first, so `hub` has something real to build against.
2. `apps/hub` — org directory, hierarchy view, role/access management, launcher shell with zero department tiles.
3. First department app, only once its DB module has completed the Section 3.1 process end-to-end and is reflected in the Module Tracker.
4. Repeat per department, in the priority order the DB scoring matrix gives — don't reorder based on frontend convenience alone.

---

## 7. Do's

- **Do** treat the ERD + RLS design as the deliverable for a new module, before any app code exists for it.
- **Do** keep every table's naming/typing consistent with the Team Members foundation schema — it's the pattern every future module inherits.
- **Do** regenerate and commit `supabase-client` types immediately after a schema change.
- **Do** run Supabase advisors after every migration and resolve findings before calling a module "done."
- **Do** fold genuinely shared UI/logic into `packages/*`, and keep app-specific code in the app.
- **Do** keep the Module Tracker in `architecture.md` current — it's the single source of truth for "what DB module pairs with what frontend app."
- **Do** design new tables assuming cross-module joins are legitimate — this is one database, not a federation of them.
- **Do** redirect unauthorized users to the Hub launcher instead of rendering empty/broken department screens.

## 8. Don'ts

- **Don't** create a database (or Supabase project) per app/module. There is one DB.
- **Don't** give any app a service-role key or a "trusted" elevated client, including Hub's admin surfaces.
- **Don't** write frontend code against a table before its RLS policies exist.
- **Don't** create `apps/team-members` as a standalone app — that surface lives in `apps/hub`.
- **Don't** let a shared package change (`ui-kit`, `auth`, `supabase-client`, `config`) ship without checking every app it fans out to.
- **Don't** hand-roll session/cookie logic per app — it lives once, in `packages/auth`.
- **Don't** free-text a field that is really a fixed set of states — use a Postgres enum, matching the existing `status`/`access_level` pattern.
- **Don't** assume a Supabase project is correct because its name matches — verify the actual target project before migrating (see project notes below).
- **Don't** reorder department module build priority ad hoc — that's what the DB scoring matrix in `architecture.md` is for.
- **Don't** scaffold apps or run terminal setup commands as a side effect of planning work — planning and execution are separate approved steps.

---

## 9. Security Boundaries (non-negotiable)

- Frontend Supabase client: **read-only**, anon key only.
- Writes: exclusively through the `db-management` API.
- Access control: **RLS only** — no app-level "trust me" shortcuts, no service-role key anywhere in app code.
- Every department app re-checks authorization itself on load; it does not inherit authorization from having a valid session.

---

## 10. Open Items to Track (not yet decided in this repo)

- The DB scoring matrix that orders department module build priority is referenced by the monorepo plan but not yet captured as its own document — create it in `architecture.md` when the first department module is being prioritized, rather than deciding order informally.
- ~~`architecture.md` doesn't exist in-repo yet~~ — **done, 2026-08-22**: created as part of the orders/`apps/atlas` build with a Module Tracker covering every module to date. The DB scoring matrix above is still not captured there — still open.
- **`orders` module written but NOT YET APPLIED** to `matnispbauvvlnbsuzxq` (`db/orders/001`-`003`, backing `apps/atlas`) — same "written, not proof of applied" distinction this section already calls out for `supabase/functions/*`. The agent that wrote it had no live Supabase credentials in its session. See `db/MIGRATIONS.md`'s "Pending" section and `apps/atlas/README.md`'s numbered follow-up list before assuming any of it is live.
- ~~Confirm the live Supabase project ID/name before any agent runs a migration~~ — **done, 2026-08-17**: the live project is `matnispbauvvlnbsuzxq` ("research-and-development-webapp"). It was not a clean slate — see `db/MIGRATIONS.md` for what else has run against it and why that history looks the way it does. Both `team-members` and `feedback` migrations (schema + advisor fixes) are applied and advisor-clean. `supabase/functions/*` are written but **not yet deployed** — that's still open.
- ~~Where `db-management` lives~~ — decided in Section 4: Supabase Edge Functions under `supabase/functions/`, called via `packages/db-management-client`.
- **Every migration that lands must be recorded in `db/MIGRATIONS.md`** (project, version, module, repo file), not just written as a `.sql` file — a `db/<module>/*.sql` file existing on disk is not proof it was ever applied; `db/MIGRATIONS.md` is what confirms that. Treat updating it as part of step 5 of Section 3.1, not an optional afterthought.
- **RLS helper functions belong in a `private` schema**, not `public` — every function created in `public` is auto-exposed by PostgREST as a callable `/rest/v1/rpc/<fn>` endpoint, which let arbitrary callers probe internal helpers like `employee_has_permission` directly with any ID (caught by the security advisor on the team-members module, fixed by `alter function ... set schema private`). Create new internal-only helper functions directly in `private` from the start; existing RLS policies keep working if a function is moved there later since policy expressions bind to the function's OID, not its schema-qualified name.
