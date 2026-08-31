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
| `20260819000000` (approx) | `hub_onboarding_and_admin` | team-members | `db/team-members/006_hub_onboarding_and_admin.sql` |
| `20260819000001` (approx) | `hub_next_employee_code_advisor_fix` | team-members | `db/team-members/007_hub_advisor_fixes.sql` |
| `20260827102505` | `orders_core_schema` | orders | `db/orders/001_orders_core_schema.sql` |
| `20260827102520` | `orders_rls` | orders | `db/orders/002_orders_rls.sql` |
| `20260827102535` | `orders_sync_cron` | orders | `db/orders/003_orders_sync_cron.sql` |
| `20260827102559` | `orders_workflow_and_escalation` | orders | `db/orders/004_workflow_and_escalation.sql` |
| `20260827102803` + `20260827102953` | `orders_advisor_fixes` + `orders_advisor_fixes_2` | orders | `db/orders/005_advisor_fixes.sql` |

First four applied 2026-08-17, everything else 2026-08-18 except the two Hub rows (2026-08-19) and the five `orders` rows (2026-08-27, see below). Security and performance advisors were
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

**Employee sign-in recovery cascade (2026-08-20, product decision, supersedes the
next-day-old simpler version below):** a sign-in attempt whose `employee_code` matches
zero rows no longer just offers to create a new row — it cascades through a recognition
sequence first, in order, so a person who mistyped/doesn't know their code isn't turned
into a duplicate record:

1. **Try phone.** If an existing row's phone matches (ignoring the wrong code), the edge
   function returns `409 { error: "phone_match_pending" }`. The frontend shows a plain
   Confirm/Cancel popup — no new fields, since the match was already found from data the
   person already typed — and confirming calls back with `action: "confirmPhoneMatch"`.
2. **Fall back to email.** If phone doesn't match anything either, `404 { error:
   "not_found" }` — the frontend now needs an email to keep looking and prompts for one,
   then calls back with `action: "lookupEmail"`. A match returns `409 { error:
   "email_match_pending" }` (same plain confirm popup, `action: "confirmEmailMatch"` on
   confirm); no match returns `404 { error: "email_not_found" }`.
3. **Create new.** Only once code, phone, AND email have all failed to match anything is
   this genuinely a new person — the frontend collects a Full Name (email already known
   from step 2) and calls back with `action: "createNew"`.

A code that **exists** but has the wrong phone/status never enters this cascade at all —
that's a real account's wrong credentials, not a recovery case, and still gets the
ordinary "no active employee matches" rejection.

The phone/email match steps **patch only genuinely missing fields, never overwrite
anything already set, and never touch `employee_code`** — confirmed by the user
explicitly rather than assumed: "only overtype the data which was missing, rest should
remain as it is." In practice that means `status` (flipped to `'active'` if it wasn't,
since otherwise the same person is locked out next visit — `employee-signin`'s exact-match
path only accepts `status = 'active'`) and `phone` (set only if the matched row's phone
was `null`, e.g. a row created via `invite-employee` before the person ever supplied one).
Confirmation popups for these two steps are deliberately confirm-only, no editable fields
(also an explicit choice, not a default) — the system fills in what's missing itself
rather than asking the person to re-enter data that's already on file.

Two things this deliberately does NOT do like a naive copy of the guest flow would have,
unchanged from the previous version of this feature:
- **Never accepts employee_code from the client on creation.** `employees.employee_code`
  is UNIQUE and, per `hub_onboarding_and_admin`'s `invite-employee` function, always
  server-allocated via `next_employee_code()` (the same race-free sequence `create-driver`
  uses for `driver_code`) — never chosen by the person, and never written into an existing
  row by the phone/email match steps either (those never touch that column at all).
- **Sets `status: 'active'` immediately on a brand-new row, not the usual `'invited'`.**
  `invite-employee`'s HR-driven flow leaves new rows `'invited'` pending a real sign-up
  step later; there's no such follow-up here.

Verified live via curl through the full state machine: an unrecognized code + a phone that
matches an existing (`'invited'`) row returns `phone_match_pending`, and confirming flips
that row's status to `'active'` while leaving `employee_code`/phone untouched; a
subsequent unrecognized code + phone that matches nothing but an email does returns
`not_found` → `email_match_pending` on the email lookup, and confirming patches the
matched row's previously-`null` phone in while leaving `employee_code`/status(already
active in that test)/email alone; a code+phone+email that all match nothing returns
`not_found` → `email_not_found` → `createNew` allocates a genuinely new server-issued code
(not the one typed). All test rows deleted afterward.

---

Earlier, simpler version of the same feature (2026-08-20, same day, superseded above): a
sign-in attempt whose `employee_code` matched zero rows returned `{ error: "not_found" }`
(HTTP 404) directly, with no phone/email recognition step — the Feedback App's login form
caught this via `EmployeeNotFoundError` and immediately offered to create a new row via
`createIfMissing: true` after collecting Full Name + Email. Replaced the same day once the
product requirement was clarified: a returning person recognizable by phone or email
should never end up duplicated into a brand-new row just because they mistyped or forgot
their employee_code.

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

**Hub module (2026-08-19, new — `db/team-members/006`–`007`):** built for `apps/hub` —
self-service sign-up/sign-in, a one-time onboarding wizard, profile, and a Team page for
role/manager admin. This is the first thing built on top of the RBAC layer
(`roles`/`role_permissions`) that `001_team_members_schema.sql` shipped with zero seeded
rows on purpose. `006_hub_onboarding_and_admin.sql` added `employees.onboarding_completed_at`
(nullable timestamptz, the single "don't show onboarding again" flag), `employee_code_seq`/
`public.next_employee_code()` (mirrors `next_driver_code()` exactly), the public
`employee-avatars` Storage bucket (same override pattern as `driver-photos`, recorded in
`AGENTS.md` Section 1), and seeded one `Admin` role bound to all 5 existing permissions,
granted to the pre-existing `vansh.g@pixxeldigital.com` employee (`PIX-001`) — the same
account already used for Internal Portal testing (see the "Demo admin user" entry below),
confirmed live via `execute_sql` before seeding rather than assumed. That account's
`onboarding_completed_at` was also set to `now()` in the same migration, since its profile
(phone, department, employment_type) already exists — it should not be forced through the
wizard. `007_hub_advisor_fixes.sql` is the standard immediate follow-up (Section 3.1 step
5): the security advisor flagged `next_employee_code`'s mutable `search_path`, fixed the
same way `next_driver_code`'s was (`db/journeys/008_driver_code_helper_fixes.sql`).

Product decision made in this session: **open sign-up**, not invite-only. Any email can
sign up via the `employee-signup` edge function; if an `employees` row already exists for
that email with no `auth_user_id` (created ahead of time by the Team page's
`invite-employee` function, `status: 'invited'`), sign-up claims it — preserving whatever
department/manager/role was preset — instead of creating a duplicate. Sign-up never uses
`supabase.auth.signUp()` directly; `employee-signup` creates the `auth.users` row itself via
the Admin API (so an unmatched attempt can never leave an orphaned auth user), and the
client calls `signInWithPassword` immediately after to satisfy "auto-login on first
sign-up." No new RLS write policy was added for employee self-service — `employees_write`'s
"no self-service path... flagged as an open decision, not built" comment (from
`001_team_members_schema.sql`) is resolved by `update-own-profile`, a service-role edge
function that checks `auth_user_id` ownership in code, matching every other write in this
repo (RLS is not the enforcement layer for edge-function writes, since they run as
service_role and bypass it by design).

Five new edge functions, all deployed and version-1 (`update-own-profile` shows version 2
in the dashboard only because an initial deploy attempt was interrupted mid-session before
the real one landed — no functional difference): `employee-signup` (`verify_jwt: false`,
mirrors `guest-signup`'s "no session yet" treatment), `update-own-profile`,
`upload-employee-avatar` (self-service version of `upload-driver-photo`, same bucket
pattern, different auth check), `invite-employee`, `update-employee` (both gated by a new
`requireEmployeePermission` helper added to `supabase/functions/_shared/authz.ts` —
generalizes `requireInternalPortalAdmin`'s pattern to an arbitrary permission key instead of
the one hardcoded `department_access_grants` check, re-implementing
`private.employee_has_permission` as plain queries for the same reason
`requireInternalPortalAdmin` already re-implements its own check). One deploy gotcha hit and
resolved in this session: the `deploy_edge_function` MCP tool bundles the entrypoint under
an internal `source/` folder, so a shared file must be named with a leading `../` (e.g.
`../_shared/authz.ts`) in the `files` array to land one level up where the repo's own
`import "../_shared/authz.ts"` actually resolves — naming it `_shared/authz.ts` (matching
the repo path literally) instead nests it under `source/` and the bundle fails with
`Module not found`.

**Orders module / Atlas (2026-08-27, new — `db/orders/001`–`005`):** built for
`apps/atlas` — unified merchant/production/shipping/sales order visibility, replacing the
standalone `Track JR Orders` tool, plus a workflow layer (structured work requests,
milestones, an append-only audit log, the real named production-escalation chain) that
replaces the order@/mzpreview@ email relay. Every design choice was prototyped and
load-tested against the live ERP feed in a local preview tool before being written as
these migrations (see `apps/atlas/README.md` and `architecture.md`). Target project
re-confirmed against real table contents (not name alone) on 2026-08-27 — see the
"Project" note above; the two-project ambiguity was also independently flagged in a
Slack exchange with Vansh Gupta the same day, directing all modules into this one shared
project rather than a new one, matching this ledger's existing guidance.

Two real issues hit and fixed during application, both now folded into the source files:
1. **`authorization` is a reserved word in Postgres** (`CREATE`/`SET ... AUTHORIZATION`) —
   `001_orders_core_schema.sql`'s `orders.authorization` column failed with a syntax error
   until quoted as `"authorization"`. Fixed in the source file itself (not a follow-up
   migration, since nothing had been applied yet when it was caught).
2. **`auth_rls_initplan` exact-shape gotcha**: wrapping the whole `->>` expression in
   `select` — `(select (auth.jwt() ->> 'sub'))` — did NOT clear the advisor's WARN on this
   project/Postgres version for `merchants_select`/`merchant_customer_codes_select`;
   only wrapping the bare function call, `(select auth.jwt()) ->> 'sub'`, did. Confirmed
   by re-running `get_advisors` after each attempt. `005_advisor_fixes.sql` carries the
   working shape and the note for any future `auth.jwt()`/`auth.uid()` policy in this
   module. (`private.can_view_order()`'s internal `auth.jwt() ->> 'sub'` call, inside a
   SECURITY DEFINER SQL function rather than a bare policy `qual`, is invisible to this
   specific advisor check — a known limitation, not something this pass chased further.)

Advisor-clean after `005`: zero security findings beyond the pre-existing project-wide
`auth_leaked_password_protection` WARN (unrelated, not from this module); zero performance
findings beyond expected `unused_index` INFO notices on these brand-new, zero-traffic
tables. `003_orders_sync_cron.sql`'s scheduled job is applied but fails closed (401) until
the `orders-sync` Edge Function is deployed and the `orders_sync_secret` Vault entry is
created — neither done yet, see "Still pending" below.

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
- ~~No seed `roles` or `role_permissions` rows exist~~ — **resolved 2026-08-19**: one
  `Admin` role now exists, bound to all 5 existing permissions, granted to
  `vansh.g@pixxeldigital.com` (`PIX-001`). See the "Hub module" entry above. Every other
  employee still has `primary_role_id = null` (no permissions) until that Admin account
  grants them a role from `apps/hub`'s Team page.
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

## Orders module — still pending (schema + Edge Functions deployed, this is what's left)

`db/orders/001`–`005` are applied and advisor-clean (see the module paragraph above). All
10 Edge Functions (there are 10, not 9 — an earlier count in this file was off by one:
`orders-sync`, `orders-update-stage`, `orders-set-shipping-detail`, `merchants-invite`,
`merchants-link-clerk-account`, `orders-create-request`, `orders-action-request`,
`orders-mark-request-seen`, `orders-record-milestone`, `orders-escalate-order`) are
deployed (2026-08-27) and version 1, `ACTIVE`, smoke-tested with real HTTP calls (each
one's own auth gate returns the expected error for a request that shouldn't be let
through — not just "the deploy call returned success"). `supabase/config.toml` also
picked up explicit `verify_jwt` entries for the five functions that were missing them
(functionally the CLI default already matched — `true`, since all five expect a real
employee session — this just closes a documentation gap matching every other function's
explicit entry).

**Admin role extended (2026-08-27):** the existing `Admin` role (bound to `vansh.g@pixxeldigital.com`, `PIX-001`, since the Hub module's original seed) did not automatically pick up `orders.read.all`/`orders.write.all` when `001` added them — Hub's original seed was a one-time "bind to every permission that exists right now," not an ongoing auto-bind. Explicitly granted both to `Admin` via a plain `role_permissions` insert, confirmed by the user, so that account can actually see/manage orders once real data exists. As of the same check: `orders` has 0 rows (`orders-sync` has never run), `merchants` has 0 rows (deliberately unseeded), and of the 3 employees with a completed signup, only `shipping@jaipurrugs.com` (a `shipping` department grant) passed the staff gate before this change — `Admin` now does too.

Still required before this module is actually usable end-to-end:
- **Set two Edge Function secrets** — `CLERK_SECRET_KEY` (confirmed missing live:
  `merchants-link-clerk-account` currently 500s with "server misconfigured") and
  `ORDERS_SYNC_SECRET` (confirmed missing live: `orders-sync` currently 401s on every
  cron tick). No Supabase MCP tool in this session can set project secrets — this needs
  `supabase secrets set <NAME>=<value>` from a CLI session authenticated to this project,
  or the Dashboard's Edge Functions → Secrets page. Both values already exist (Clerk's is
  in `apps/atlas/.env.local`'s `CLERK_SECRET_KEY`; the sync secret needs to be freshly
  generated and must match whatever `db/orders/003_orders_sync_cron.sql`'s Vault entry
  gets — see that file's own comment) — this repo/session just can't push them to the
  platform itself.
- Once `ORDERS_SYNC_SECRET` exists as an Edge Function secret, still create the matching
  `orders_sync_secret` Vault entry (`select vault.create_secret(...)`) so `003`'s
  scheduled job's `x-orders-sync-secret` header actually matches — both sides need the
  same value, and neither exists yet.
- Regenerate `packages/supabase-client`'s types — the current `types.ts` has a
  hand-authored section for this module, clearly flagged at the top of the file, standing
  in until then.
- Configure Clerk as a Supabase Third-Party Auth provider in the Dashboard (see
  `AGENTS.md`'s recorded override on Clerk) — a manual Dashboard step, not something a
  migration file can do.

**Pilot scope, confirmed by Ayaan (2026-08-27):** London — customer code `34836`
(back-ops: Rahul Sharma, head: Gaurav Mehtani) — a single person, single head, and the
best-evidenced code in the corpus (the Theodora Jury thread traces punch → PSFT →
warehouse → AWB end to end on this exact code). Apply the migration, seed **only**
Rahul Sharma's employee account with a `nav`-adjacent... actually a `sales`/backend
department grant scoped to this pilot before wider rollout — do not seed the other six
back-ops staff or their regions yet. `escalation_levels.notify_employee_id` for all
three rungs (Amit Dagar; Vishal Verma & Sumit Yadav; Yogesh Chaudhary) stays **null**
until those four people have real employee accounts (via Hub signup) — escalating still
records correctly without it, it just can't notify yet. Merchant identity (who
externally, if anyone, gets Clerk self-service login for 34836 in this pilot) is
still **unconfirmed** — do not seed a `merchants` row with a guessed name/email.
