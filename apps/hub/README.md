# Hub

The "common interface" app named in root [`AGENTS.md`](../../AGENTS.md) Section 2: employee
sign-up/sign-in, a one-time multi-step onboarding wizard, a profile page, and a Team page
for department/manager/role administration. This is the app the `employees`/`roles`/RBAC
schema in `db/team-members/001_team_members_schema.sql` was designed for.

## Status

Newly built (2026-08-19). Migration `db/team-members/006_hub_onboarding_and_admin.sql`
adds the onboarding-complete flag, the `employee-avatars` Storage bucket, the
`employee_code_seq`/`next_employee_code()` allocator, and seeds one `Admin` role (bound to
every existing permission) granted to the pre-existing `vansh.g@pixxeldigital.com` account
(`PIX-001`) so there's someone who can use the Team page from day one.

## Stack

Same as every other app in this repo — Next.js 16 (App Router, `proxy.ts` not
`middleware.ts`), React 19 + Hero UI v3, Tailwind v4 (CSS-first), the one shared Supabase
project (`matnispbauvvlnbsuzxq`), writes exclusively through `supabase/functions/*` via
`@jaipur-rugs/db-management-client`. See root `AGENTS.md` for the full org-wide contract.

## Local development

```bash
pnpm install                        # from repo root
pnpm --filter @jaipur-rugs/hub type-check
pnpm --filter @jaipur-rugs/hub dev  # http://localhost:3000
```

Required env (`.env.local`, see `.env.example`): `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_ROOT_DOMAIN` (leave empty locally).

## Architecture

### Sign-up is real Supabase Auth, but the auth user is created server-side

Unlike the Feedback App's guest/employee logins (deliberately *not* Supabase Auth), Hub
uses real email/password accounts — that's the whole point of a common login every other
app's session gets shared with. But the client never calls `supabase.auth.signUp()`
directly: it invokes the `employee-signup` edge function, which creates the `auth.users`
row itself (Admin API) only after resolving the `employees` side (claim a pre-invited row
by email, or create a fresh one — see the function's own comment), then the client calls
`signInWithPassword` right after to establish the real session. This is what makes
"auto-login after first sign-up" reliable and avoids ever leaving an orphaned auth user
with no matching employee record.

### Onboarding is one boolean, checked twice

`employees.onboarding_completed_at` (nullable) is the single source of truth. `proxy.ts`
redirects to `/onboarding` whenever it's null and the request isn't already headed there;
`app/(shell)/layout.tsx`'s `requireHubAccess()` re-checks the same thing server-side before
rendering `/profile` or `/team` (AGENTS.md Section 5's "every app independently
re-verifies... on load", the same dual-check pattern Internal Portal already uses for its
admin gate). `update-own-profile` sets the timestamp the first time it's called for a given
employee — both the onboarding wizard's last step and later `/profile` edits call the same
function, so there's no separate "complete onboarding" endpoint.

### Team page permissions

"Add team member" and the row-level edit action are gated by the `employees.write`
permission, resolved two different ways depending on direction:
- **Read** ("should I show these buttons at all") — `lib/auth/requireHubAccess.ts` checks
  it with the ordinary RLS-scoped read-only client (`role_permissions`/`permissions` are
  open-`SELECT` reference tables, see `001_team_members_schema.sql`), no edge function
  needed.
- **Write** (the actual invite/edit) — `invite-employee`/`update-employee` re-check it
  server-side via `requireEmployeePermission` (`supabase/functions/_shared/authz.ts`),
  since a client-side "don't show the button" check is never itself an authorization
  boundary.

Inviting someone (`status: 'invited'`, no `auth_user_id`) composes with open sign-up: if
that person later signs up with the same email, `employee-signup` claims the existing row
instead of creating a duplicate, preserving whatever department/manager/role was preset.

## Database

Full ERD: [`db/team-members/team-members-schema.mmd`](../../db/team-members/team-members-schema.mmd).
Full migration ledger: [`db/MIGRATIONS.md`](../../db/MIGRATIONS.md) — the source of truth
for what's actually applied, not just what's on disk.

| Migration | What it added |
|---|---|
| `001_team_members_schema.sql` | `employees`/`roles`/RBAC schema this app is built on |
| `006_hub_onboarding_and_admin.sql` | `onboarding_completed_at`, `employee_code_seq`/`next_employee_code()`, `employee-avatars` bucket, seeded `Admin` role |

### Edge functions (this module)

| Function | Auth required | Does |
|---|---|---|
| `employee-signup` | None (bootstrap step) | Claims a pre-invited row by email, or creates one. Creates the `auth.users` row itself. |
| `update-own-profile` | Any authenticated employee | Updates the caller's own row; sets `onboarding_completed_at` on first call. |
| `upload-employee-avatar` | Any authenticated employee | Uploads to `employee-avatars`, returns the object key. |
| `invite-employee` | `employees.write` | Creates a `status: 'invited'` row (Team page "Add team member"). |
| `update-employee` | `employees.write` | Sets department/manager/role/employment type/status on any employee. |

## What to touch, what not to touch

Same rules as every other app (see `apps/admin/feedback-app/README.md` for the fuller
version of this list) — in particular: reads go through the shared read-only client
directly, writes always through an edge function via `db-management-client`, never edit an
already-applied `db/*.sql` file in place (add a new numbered one), and regenerate
`packages/supabase-client/src/types.ts` after any schema change.

## Related docs

- Root [`AGENTS.md`](../../AGENTS.md) — org-wide conventions, tech stack, RLS/write-path rules.
- [`db/MIGRATIONS.md`](../../db/MIGRATIONS.md) — full migration ledger, every module.
- [`db/team-members/team-members-schema.mmd`](../../db/team-members/team-members-schema.mmd) — ERD.
