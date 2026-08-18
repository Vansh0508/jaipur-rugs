# Migration Ledger

Source of truth for what has actually been applied to the live Supabase project, in
order. Each module's SQL lives in `db/<module>/*.sql`; this file is the cross-module
record of what ran, when, and against which project — the thing to check before assuming
any `db/<module>/*.sql` file has (or hasn't) actually been applied yet.

## Project

**`matnispbauvvlnbsuzxq`** ("research-and-development-webapp", org `uiidgctbjzkriqqvaklx`,
region `ap-south-1`). Confirmed with the user on 2026-08-17 — the only other candidate,
`eevzwnjjcedyuehpprgk` ("Jaipur Rugs Foundation"), already holds live, unrelated data
(a forms/submissions app) and was ruled out. Per `AGENTS.md` Section 10: don't assume this
project by name alone if it's ever re-verified — confirm again if there's any doubt.

## Applied migrations

| Version (Supabase) | Name | Module | Repo file |
|---|---|---|---|
| `20260817120207` | `team_members_schema` | team-members | `db/team-members/001_team_members_schema.sql` |
| `20260817120223` | `feedback_schema` | feedback | `db/feedback/001_feedback_schema.sql` |
| `20260817120530` | `team_members_advisor_fixes` | team-members | `db/team-members/002_advisor_fixes.sql` |
| `20260817120540` | `feedback_advisor_fixes` | feedback | `db/feedback/002_advisor_fixes.sql` |
| (2026-08-18) | `drop_stale_auth_trigger` | team-members | `db/team-members/003_drop_stale_auth_trigger.sql` |
| (2026-08-18) | `guest_tracking_only_no_auth_user` | feedback | `db/feedback/003_guest_tracking_only.sql` |
| (2026-08-18) | `seed_drivers_and_vehicles` | feedback | `db/feedback/004_seed_drivers_and_vehicles.sql` |
| (2026-08-18) | `create_driver_photos_bucket` | feedback | `db/feedback/005_create_driver_photos_bucket.sql` |
| (2026-08-18) | `seed_admin_departments` | team-members | `db/team-members/004_seed_admin_departments.sql` |
| (2026-08-18) | `journeys_vehicles_and_drivers_extensions` | journeys | `db/journeys/001_vehicles_and_drivers_extensions.sql` |
| (2026-08-18) | `journeys_core_schema` | journeys | `db/journeys/002_journeys_core_schema.sql` |
| (2026-08-18) | `journey_admin_helpers_and_write_functions` | journeys | `db/journeys/003_journey_admin_helpers_and_write_functions.sql` |
| (2026-08-18) | `journeys_feedback_planned_and_moderation` | journeys | `db/journeys/004_feedback_planned_and_moderation.sql` |
| (2026-08-18) | `journeys_rls` | journeys | `db/journeys/005_journeys_rls.sql` |
| (2026-08-18) | `journeys_advisor_fixes` | journeys | `db/journeys/006_advisor_fixes.sql` |
| (2026-08-18) | `journeys_driver_code_helper` | journeys | `db/journeys/007_driver_code_helper.sql` |
| (2026-08-18) | `journeys_driver_code_helper_fixes` | journeys | `db/journeys/008_driver_code_helper_fixes.sql` |
| (2026-08-18) | `team_members_fix_employees_select_recursion` | team-members | `db/team-members/005_fix_employees_select_recursion.sql` |
| (2026-08-18) | `employee_code_phone_login` | feedback | `db/feedback/006_employee_code_phone_login.sql` |

First four applied 2026-08-17, everything else 2026-08-18. Security and performance advisors were
run after every migration — findings were fixed in follow-up migrations as they appeared
(006, 008) rather than deferred. The only standing findings as of this ledger: an
INFO-level "guests has RLS enabled but no policies for `anon`/unauthenticated" (intentional
— superseded by 005_journeys_rls.sql's admin-only policy for `authenticated`), "unused
index" INFO notices (expected, no real query traffic yet), and a project-level
`auth_leaked_password_protection` WARN (Supabase Auth's HaveIBeenPwned check is off — a
global Auth setting, not a per-migration schema issue, and out of scope for this feature;
flagged here for whoever owns project-wide Auth configuration). Both modules are
advisor-clean at the WARN/ERROR level for anything schema-related.

Current live schema (as of the last migration above): `departments`, `roles`,
`employees`, `employee_roles`, `department_access_grants`, `apps`, `permissions`,
`role_app_access`, `role_permissions` (team-members) plus `drivers`, `guests`, `feedback`,
`vehicles` (feedback module) plus `journeys`, `journey_guests`, `journey_stops`,
`journey_stop_guests` (journeys module) — matching `db/team-members/team-members-schema.mmd`,
`db/feedback/feedback-schema.mmd`, and `db/journeys/journeys-schema.mmd`. Helper functions
(`current_employee_id`, `fn_is_in_manager_chain`, `employee_has_permission`,
`employee_has_app_access`, `is_internal_portal_admin`, plus the journeys module's two
trigger functions) live in a non-exposed `private` schema — not callable as public RPC
endpoints. `create_journey`/`update_journey` are the sole exceptions living in `public`
(required so `.rpc()` can reach them via PostgREST), with `EXECUTE` restricted to
`service_role` only.

**Journeys module (2026-08-18, new — `db/journeys/001`–`006`):** built for
`apps/admin/internal-portal`'s Journeys/Cars/Drivers feature. Extends `vehicles`
("Cars") with `name`/`status`/`qr_code_url` and `drivers` with a mandatory E.164 `phone`
+ `driver_code_seq`, rather than creating a parallel `cars` table. Adds `journeys` (one
car + one driver per journey, `driver_id`/`vehicle_id` both mandatory), `journey_guests`,
`journey_stops` (ordered route, exactly one `origin`/`destination` via partial unique
indexes), `journey_stop_guests`. The double-booking guarantee is two Postgres `EXCLUDE`
constraints (GiST, `btree_gist`, relocated to the `extensions` schema per the security
advisor) on a generated `busy_window` range — verified live via `execute_sql`: an
overlapping booking for the same vehicle raises `journey_conflict:...` and rolls back
atomically (guests/stops from the failed attempt are not left behind), a booking starting
strictly after a prior one's last drop succeeds (car correctly freed), and the
origin-pickup-only/destination-drop-only trigger correctly rejects a malformed route — all
three cases exercised and cleaned up in this session, not just asserted. `date_from`/
`date_to` on `journeys` are plain columns kept in sync by a trigger, not `generated always
as` columns — Postgres rejected the original design with `generation expression is not
immutable` (casting `timestamptz` to `date` depends on the `TimeZone` GUC, which is
`STABLE`, not `IMMUTABLE`). `feedback` gained `journey_id`/`review_status`/`reviewed_by`/
`reviewed_at` to distinguish auto-approved planned-ride reviews from pending unplanned-ride
reviews (fraud-prevention ask). Authorization for the whole module is one primitive,
`private.is_internal_portal_admin(emp_id)`: an employee with a `department_access_grants`
row on the `admin` department at `access_level = 'admin'` — not routed through
`employee_has_permission`/roles, since that catalog has zero seeded rows (see "Still
pending" below) and would make the feature non-functional out of the box. No
INSERT/UPDATE policy exists on any new table — every write goes through
`create_journey`/`update_journey` or a service-role Edge Function, matching the
`feedback`/`guests` precedent, not `employees`/`departments`'s permission-gated direct
writes.

**Pre-existing bug fixed (2026-08-18): `employees_select` infinite recursion.** Discovered
by a real browser walkthrough of `apps/admin/internal-portal` (Playwright), not by advisor
or SQL testing — its "same department" branch was a raw subquery directly against
`employees` (`department_id = (select department_id from employees where auth_user_id =
auth.uid())`), introduced in `002_advisor_fixes.sql` on 2026-08-17. Unlike
`current_employee_id()`/`fn_is_in_manager_chain` (SECURITY DEFINER, so their internal
`employees` lookups bypass RLS), this raw subquery ran under the same RLS context it was
already computing, re-triggering `employees_select` on itself — confirmed live via
`42P17: infinite recursion detected in policy for relation "employees"` on a plain
authenticated self-lookup, even though the policy's first OR branch
(`auth_user_id = auth.uid()`) would independently have been true (Postgres doesn't
guarantee short-circuit evaluation of OR'd subqueries in a RLS USING clause). This
silently affected every app that would ever query `employees` under a real session with
anon-key RLS (not just internal-portal) — `feedback-app` never hit it only because it
never queries `employees` at all. Fixed in `db/team-members/005_fix_employees_select_recursion.sql`
by adding `private.current_employee_department_id()` (SECURITY DEFINER, same pattern as
`current_employee_id()`) and using it in place of the raw subquery. Verified live via a
direct signed-in query (both `employees` and `department_access_grants` self-lookups now
return data with no error) and via the browser walkthrough succeeding end-to-end after
the fix.

**Demo admin user (2026-08-18, one-off, not a tracked migration):** `departments` gained
two rows via `004_seed_admin_departments.sql` — `Admin`/`admin` (the Internal Portal's
gating department, not a real HR department) and `Pixxel`/`pixxel`. Separately (via
`execute_sql`, not `apply_migration`, since this is operational data, not schema): an
`auth.users` row for `vansh.g@pixxeldigital.com` / password `Vansh@123` (created directly
with `pgcrypto`'s `crypt()`/`gen_salt('bf')`, plus a matching `auth.identities` row — no
service-role key was available to this session for the Admin API path the original plan
assumed, so direct SQL insertion was used instead, a documented-safe Supabase pattern), an
`employees` row (`PIX-001`, department `Pixxel`, `status='active'`, linked via
`auth_user_id`), and a `department_access_grants` row (`admin` department,
`access_level='admin'`). Verified live: `private.is_internal_portal_admin()` returns
`true` for this employee.

**Driver roster + vehicle fleet seed (2026-08-18):** 13 real drivers and 14 real vehicles,
provided by the Admin Team, inserted directly. `vehicles` is a new, independent table —
the two source lists don't map 1:1 (different counts, no assignment given), so no
`driver_id` FK was invented; add one later if a real assignment is provided. Because
`drivers` is `anon`-readable (guests need it with no session) and now holds real personal
phone numbers, this migration also tightened that: `anon` lost blanket table SELECT and
was re-granted only the non-sensitive columns (`id`, `driver_code`, `full_name`,
`photo_path`, `status`, `created_at`, `updated_at`) — `phone` and `department_id` are
`authenticated`-only. Verified live: an anon request for `phone` gets a `42501 permission
denied`, not a silently-empty field.

**Guest tracking redesign (2026-08-18, product decision):** guests are NOT Supabase Auth
users — no `auth.users` row, no session, ever. `guest-signup` is pure phone-match-or-create
data entry; the app remembers "this browser is guest X" with a plain (non-httpOnly) cookie
(`jr_guest_id`), not a session. `feedback.reviewer_auth_user_id` is now nullable and
`feedback.guest_id` was added — exactly one of the two is set per row (`feedback_reviewer_xor_guest`
check constraint). `drivers` SELECT is open to the `anon` role too, since guests have no
session at all to gate on. This superseded the original design where `guests.auth_user_id`
linked to a server-issued Supabase Auth phone identity — that path was never reachable in
practice (see `drop_stale_auth_trigger` below) and the product decision made it moot anyway.

**Employee login redesign (2026-08-18, product decision, same session as the above):**
the Feedback App's employee tab no longer uses Supabase Auth (email/password) either —
matched against `employees.employee_code` + `employees.phone` instead, via a new
`employee-signin` edge function, mirroring the guest redesign exactly. No `auth.users`
row, no session; the app remembers "this browser is employee X" with a plain cookie
(`jr_employee_id`). `feedback.employee_id` was added and the reviewer CHECK constraint
widened from a 2-way XOR to `feedback_reviewer_exactly_one` (exactly one of
`reviewer_auth_user_id`/`guest_id`/`employee_id` — the first is now vestigial for this
app, kept only in case some other real-session integration ever needs it).
`employees.phone` has no enforced format (the one seeded row, `PIX-001`, is a bare
10-digit domestic number) — matching is digit-normalized on the last 10 digits, not exact
string equality, and the frontend uses a plain phone field (no country-code picker) for
this tab, unlike the guest tab's mandatory E.164. Verified live: sign-in with the exact
stored phone, sign-in with the same phone in a different format (still matches),
wrong-phone rejection returns the specific "no active employee matches" message (not a
generic HTTP error — `db-management-client` now extracts the real edge-function error
body via a shared `extractErrorMessage` helper), and a full submit-feedback round trip
via `employeeId` lands with `employee_id` set and both other reviewer columns null. All
test rows deleted afterward. `proxy.ts` was simplified accordingly — neither login path
produces a Supabase session in this app anymore, so the gate now checks only the two
cookies (`jr_guest_id`/`jr_employee_id`), no `@jaipur-rugs/auth`/session client involved.
Checked before making this change: `apps/admin/internal-portal`'s feedback queries
(`lib/queries/feedback.ts`) never select `reviewer_auth_user_id`, so nothing there broke.

Also on 2026-08-18: dropped a stale `on_auth_user_created` trigger + `internal.handle_new_user()`
function, orphaned debris from the pre-existing (unrelated, superseded) schema on this
project — it inserted into `public.profiles`, a table that no longer exists, and broke
every new-user creation attempt with "Database error creating new user" (this is what the
original guest-signup admin.createUser call hit). Unrelated to the guest-tracking redesign
itself, but discovered and fixed in the same session.

**Driver photos bucket (2026-08-18, deliberate stack override):** `driver-photos` is a
public Supabase Storage bucket — a conscious, discussed override of AGENTS.md's default
"self-hosted S3, not Supabase Storage" choice (recorded in AGENTS.md Section 1), scoped to
this one use case. Public bucket means reads bypass RLS entirely (anyone with the object
URL can view it — confirmed live: `GET .../storage/v1/object/public/driver-photos/<key>`
for a non-existent key returns a clean `404 Object not found`, not an auth error). No
RLS policy was added for writes, so by Storage's own default (no policy = no client
writes), only the service role can upload until an admin UI exists. `drivers.photo_path`
resolves against this bucket via `lib/env.ts`'s `resolvePhotoUrl()` in
`apps/admin/feedback-app` — no separate S3 base URL env var needed anymore.

## Pre-existing history on this project (context, not part of this module's schema)

This project was not a clean slate. Its migration history (`supabase_migrations.schema_migrations`)
records, before the migrations above:

1. `phase1_foundation` / `phase1_lockdown_internal_functions` / `phase1_perf_advisories`
   (2026-08-13) — a **different, unrelated application**: a design/order-approval workflow
   system (`profiles`, `pipelines`, `pipeline_stages`, `projects`, `requests`,
   `attachments`, `audit_log`, roles like `designer`/`coordinator`/`production`/`admin`).
2. `drop_rd_webapp_schema_for_foundation_rebuild` (2026-08-17, hours before the migrations
   in this ledger) — dropped all of #1's tables and types with `CASCADE`. Confirmed
   expected/known by the user — not a recovery situation.
3. `create_team_members_foundation_schema` / `fix_foundation_schema_advisor_findings`
   (2026-08-17, same window) — a **different, simpler team-members schema** than the one
   in this repo (no RBAC/apps/permissions layer, `access_level` as just `read`/`write`, no
   `invited` status). By the time this session checked, that schema was already gone too
   (not via a tracked migration — removed by a raw statement outside `apply_migration`).

The schema in this repo (`db/team-members`, `db/feedback`) is the authoritative one going
forward, per the user's explicit call — #3's design is superseded, not merged. Recorded
here only so a future reader of the Supabase migration history isn't confused about what
`drop_rd_webapp_schema_for_foundation_rebuild` or `create_team_members_foundation_schema`
were, since neither corresponds to anything in this repo.

## Still pending

- `supabase/functions/guest-signup`, `employee-signin`, and `submit-feedback` are deployed
  and live-tested (`submit-feedback` is version 4 as of the employee-login redesign;
  `employee-signin` is new, version 2 after the phone-matching fix) —
  `packages/supabase-client/src/types.ts` is regenerated and current.
- No seed `roles` or `role_permissions` rows exist — only the `apps` and `permissions`
  catalog rows from the team-members migration's seed data. Nobody currently has any
  permission at all, which is a safe default but means no admin UI action will succeed
  until at least one role is created and granted permissions directly in the database.
- `drivers` (13) and `vehicles` (14) are seeded with real data as of 2026-08-18 — the
  driver grid has real content now. Driver photos (`photo_path`) are still unset for all
  of them, so the grid falls back to initials until photos are uploaded to S3 and the
  column is populated (out-of-band for now; no admin UI exists to manage this yet).
- Journeys module Edge Functions (`create-car`, `update-car-status`, `create-driver`,
  `create-journey`, `update-journey`, `cancel-journey`, `approve-feedback`, plus the
  extended `submit-feedback`, version 3) are deployed and live-tested (2026-08-18, same
  session as the schema) — every one exercised end-to-end over real HTTP with the demo
  admin's actual session token, not just unit-style SQL calls: create-car, the
  create-journey happy path, its 409 conflict path, cancel-journey, update-car-status
  (including the maintenance→vacant round trip), create-driver (allocated `DRV-014` off
  `driver_code_seq`, correctly continuing after the seeded `DRV-001..013`), submit-feedback
  without a `journeyId` (confirmed `pending`), and approve-feedback (confirmed
  `pending`→`approved`). All test rows created during this verification were deleted
  afterward. `apps/admin/internal-portal` (the frontend consuming these) is still being
  built in this same session — check `apps/admin/internal-portal/` directly rather than
  assuming this ledger entry is stale.
- `vehicles.qr_code_url` is nullable and unpopulated for all 14 rows — the QR-generation
  endpoint doesn't exist yet (explicitly deferred, per the Internal Portal spec).
