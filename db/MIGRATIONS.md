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
| `20260901062335` | `merchant_auth_consolidation` | orders | `db/orders/006_merchant_auth_consolidation.sql` |
| (2026-09-02) | `orders_sync_secret_rpc_bridge` | orders | `db/orders/007_orders_sync_secret_rpc_bridge.sql` |
| (2026-09-02) | `orders_sync_move_to_server` | orders | `db/orders/008_orders_sync_move_to_server.sql` |
| (2026-09-02) | `orders_select_perf_fix` | orders | `db/orders/009_orders_select_perf_fix.sql` |
| (2026-09-02) | `salesperson_codes_self_service` | orders | `db/orders/010_salesperson_codes_self_service.sql` |
| `20260905151709` | `management_department_self_service` | orders | `db/orders/011_management_department_self_service.sql` |
| `20260905151821` | `department_access_grants_unique_index` | orders | *(no repo file — applied directly, not yet backfilled)* |
| `20260905160648` | `delay_alerts` | orders | `db/orders/012_delay_alerts.sql` |
| `20260907053134` | `nav_direct_fields` | orders | `db/orders/013_nav_direct_fields.sql` |
| `20260907091911` | `follow_up_person_directory` | orders | `db/orders/014_follow_up_person_directory.sql` |
| `20260907094425` | `follow_up_person_directory_routing_names` | orders | `db/orders/015_follow_up_person_directory_routing_names.sql` |
| `20260907161313` | `shehbaaz_email` | orders | `db/orders/016_shehbaaz_email.sql` |
| `20260910054158` | `seed_backops_department` | orders | *(applied via `execute_sql`/`apply_migration` before this row's repo file existed — see 017 below)* |
| `20260910060119` | `backops_department_self_service` | orders | `db/orders/017_backops_department_self_service.sql` |
| (2026-09-11) | `orders_perf_facets_and_stats_rpcs` | orders | `db/orders/018_perf_facets_and_stats_rpcs.sql` |
| (2026-09-11) | `customer_codes_add_conflict_fix` | orders | `db/orders/019_customer_codes_add_conflict_fix.sql` |
| (2026-09-11) | `rug_lens_facets_cross_filter` | orders | `db/orders/020_rug_lens_facets_cross_filter.sql` |
| — (written, NOT applied, deliberately) | `nav_full_field_expansion` | orders | `db/orders/021_nav_full_field_expansion.sql` |
| (2026-09-12) | `column_requests` + `column_requests_resolved_by_index` | orders | `db/orders/022_column_requests.sql` |

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

**Orders module — dispatch status + shipment tracking (2026-09-15, applied —
`db/orders/029_dispatch_tracking.sql`):** real "Dispatched" stage + courier tracking
info, closing a genuine gap found investigating a merchant-reported rug-count
discrepancy (see `ERP_AND_EXTERNAL_REQUESTS.md` request #9 for the full story — a
dispatched rug just silently disappears from `NAV-002-Rug List - Main`, the view
`orders-sync.mjs` otherwise reads from, with no "Dispatched" status text anywhere in
it; the real fact only exists in two entirely different NAV reports).

New `dispatched` stage (`is_terminal = true`, deliberately not reusing the existing
`delivered` stage — checked first, it had zero raw_status mappings, i.e. unused, but
"delivered" means the customer actually received it, a later and distinct real-world
milestone). Six new nullable `orders` columns: `dispatched_at`, `sales_shipment_no`
(from `NAV-011- Posted Whse Shipment Packing List`, keyed on Item No_ — this schema's
real unique key, not OTN No_, which isn't guaranteed unique), and `tracking_no` /
`shipping_agent_code` / `shipping_agent_name` / `ewb_no` (from a separate AWB-tracking
NAV view, `View-0462-Sales_Inv_With_AWB_Tracking_And_Bale_Wise_Details`, also keyed on
Item No_ — `shipping_agent_name` resolved from NAV's own `JRCPL Live$Shipping Agent`
master table at sync time, e.g. "MH-004" -> "BLUE DART EXPRESS LIMITED", confirmed live
rather than assumed from the raw code).

Both new sync passes (`orders-sync.mjs`'s `syncDispatchStatus`/`syncTrackingInfo`, run
after the main sync loop so they have final say on `stage_id`) only ever UPDATE an
existing `orders` row — they deliberately do not insert a new row for an item either
source NAV report mentions that Supabase has never synced via `NAV-002` at all (this
really happens, see request #9's finding of 9 such rugs) — backfilling a never-synced
order is a bigger, separate decision than showing dispatch status for orders Atlas
already knows about. Both passes also only ever touch a field while it's still null —
never cleared once set — because both source NAV reports only retain a rolling window
(confirmed live: NAV-011 ~30 days, the tracking view ~3 months); an item aging out of a
later pull must not be read as "undo the dispatch."

`is_terminal = true` means this "just works" with `private.orders_on_time_status()`
(024_on_time_status_view.sql) and `orders-delay-alerts.mjs`'s terminal-stage exclusion —
both already treat any terminal stage as on-track/not-alertable, zero code changes
needed in either. Advisor-clean after applying (checked — only the pre-existing
project-wide `auth_leaked_password_protection` WARN, unrelated).

**Also found, not yet understood, flagged separately**: a `nav011_pull_requests` table
(shipment_id, warehouse_no, status, claimed_at, result jsonb, error, requested_by,
requested_at, completed_at — looks like an async request-queue design, maybe for an
on-demand per-shipment NAV-011 lookup) exists live on this project but has **zero
references anywhere in git history** — `git log`/`git fetch` confirmed no unpulled
commits contain it. Someone applied it directly without ever committing a migration
file for it, a real violation of this same file's own "every migration that lands must
be recorded here" rule. Not used by the feature above (which reads NAV-011 directly, in
bulk, on the same schedule as everything else) — flagged for Ayaan/Vansh to explain or
clean up, not touched or built on top of by this pass.

**Orders module — filter-aware summary totals for /orders (2026-09-17, applied —
`db/orders/032_orders_filtered_summary_rpc.sql`):** one new read-only function,
`public.orders_filtered_summary(...)`, backing a new summary panel above the Orders
table — total pieces and square feet (`std_cubage`) over the FULL filtered set, split by
`computed_on_time_status` (Delayed / Late / On track / No target date), plus a per-stage
breakdown. Direct request from the production team's UAT walkthrough the same morning:
explicitly *not* another column — a rollup that follows whatever filters are on, so
nobody exports to Excel to sum square feet by hand. Aggregated in Postgres for the same
reason as `018`: /orders is paginated server-side, so summing the rows on screen would
be wrong for any filter matching more than one page. Its 22 parameters mirror
`applyOrderFilters()` branch for branch (the same TS<->SQL duplication `018`/`024`
already carry; `getOrdersSummary()` in `apps/atlas/lib/queries/orders.ts` is the only
caller and owns the mapping — a new filter needs a parameter here AND a line there, and
the panel's total disagreeing with the table's count is the tell). `security invoker`,
reading through `orders_with_on_time_status` (`024`), so `orders_select` RLS scopes it
identically to the table beneath it and its Delayed/Late split is the exact same status
each row's badge shows. Dry-run as a plain query against live data before applying:
unfiltered total matched a direct `count(*)` exactly (13,983 non-stock rows), ~280ms
for the full aggregate including the view's two per-row `private.*` calls. Applied via
`apply_migration` from this session; advisors clean afterwards (security: only the
pre-existing project-wide `auth_leaked_password_protection` WARN; performance: only
pre-existing INFO notices, none touching this function). Frontend gate: the panel is
fetched and rendered only for production-department members — not admins either, asked
explicitly — direct request at approval time, "this view should be visible only to
production team."

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

**Dashboard/Orders/RugLens performance fix — written, NOT yet applied (2026-09-11,
`018_perf_facets_and_stats_rpcs.sql`).** Ayaan reported the app feeling slow switching
between Dashboard/Orders/RugLens and applying filters. Confirmed live via `execute_sql`/
`EXPLAIN ANALYZE` (read-only, no writes) against the real data (46,234 rows, 13,633
non-stock): `listOrderFacets`, `listAllOrdersForStats`
(`apps/atlas/lib/queries/orders.ts`) and `listRugLensFacetValues`
(`apps/atlas/lib/queries/rugLens.ts`) each paged through EVERY matching row in
sequential 1000-row round trips (PostgREST's per-request cap) and deduped/aggregated in
JS, on every single page load — ~14 round trips for Orders' facets, ~14 more for the
Dashboard's stats, ~33 for RugLens' facets. `018` adds three plain SQL functions
(`orders_list_facets`, `orders_dashboard_stats`, `rug_lens_facets`) that do that same
work in Postgres in one round trip instead — all SECURITY INVOKER (the default), so the
existing `orders_select` RLS policy still scopes them exactly as it does any other query.
Measured live: ~150ms / ~100-1400ms / ~570ms respectively, replacing what were multi-
second sequential round trips.

**Applied 2026-09-11**, after first being blocked by this environment's own permission
system on the first attempt (a live-production-database write needs Ayaan's explicit
go-ahead — asked directly, confirmed, then applied) and Ayaan asking two direct follow-up
questions first (answered inline in that session, not repeated here): whether a
code-only "fetch the same pages in parallel instead of one-by-one" alternative could
avoid a database change at all (yes, but slower and heavier than pushing the work into
Postgres — he chose the SQL-function approach), and whether adding these functions could
affect other apps sharing this same Supabase project (confirmed directly: no existing
function had these names before this migration, all three only ever read `orders`, none
can write anything, and the same RLS policy still gates them for every caller regardless
of which app they normally use).

Verified live immediately after applying: `get_advisors` (security + performance) shows
no new findings beyond the pre-existing ones already on record; `orders_dashboard_stats()`
returns `{total: 13633, distinct_sales_orders: 3786, delayed_count: 9444, counts_by_stage:
{...7 stages...}}`; `orders_list_facets()` returns 165 distinct qualities / 7,488 designs /
130 merchants; `rug_lens_facets(false)` returns 23 locations / 178 qualities — all sane
numbers, all returned in one round trip.

The three application-code query functions (`listOrderFacets`/`getDashboardStats`/
`listRugLensFacets`) and the three pages that call them (`dashboard`, `orders`,
`rug-lens`) were updated to call these RPCs by name — confirmed compiling clean via
`pnpm --filter @jaipur-rugs/atlas type-check` and a full `pnpm --filter @jaipur-rugs/atlas
build`. `packages/supabase-client/src/types.ts`'s `Functions` block was hand-updated to
add these three (same "hand-authored, not yet regenerated" exception already flagged at
that file's own header for this module).

**Update, same day: deployed to the office server.** Ayaan asked for the office server
(`192.168.0.18`) specifically, not the VPS. Committed + pushed to
`atlas-workflow-and-deploy` (only `listOrderFacets`/`getDashboardStats`, the Dashboard
page, `types.ts`, this ledger, and `018` itself — deliberately NOT `lib/queries/rugLens.ts`
or the RugLens pages, since those had independently moved on under a parallel session,
see below), then on the server: `git pull` (clean fast-forward), `pnpm run build`
(succeeded), `pm2 restart atlas`. Verified after restart: `pm2 logs atlas` showed no new
errors (the log file's last-modified timestamp was 4 hours stale, i.e. nothing new had
been written to it since well before this restart), and a plain `curl` against `/`,
`/orders`, `/dashboard`, `/rug-lens` all returned `307` (the documented healthy
login-redirect response). VPS (`atlas.jaipurrugsai.cloud`) deliberately left untouched.

**RugLens facets, part 2 (2026-09-11, `020_rug_lens_facets_cross_filter.sql`) — the
RugLens speed-up completed.** While wiring `018`'s `rug_lens_facets(boolean)` into
`lib/queries/rugLens.ts`, this session discovered that a parallel session had, hours
earlier, already tried almost the same thing, independently, on the same file: shipped
code calling that exact RPC before `018` had actually been applied, which broke every
real `/rug-lens` page load in production (`PGRST202`) until reverted the same day — see
that revert's own incident note (still readable in `lib/queries/rugLens.ts`'s git
history) and the fact `018`'s row above was initially marked "written, NOT yet applied"
for exactly this reason. That revert also added a real feature on top while fixing the
outage: RugLens' Location/Quality/Size filters now cross-narrow each other (picking one
shrinks what the other two can even offer), which the original single-argument
`rug_lens_facets(boolean)` never supported — reintroducing it as-is would have silently
regressed that feature, so this session deliberately left `rugLens.ts` on the safe,
reverted, non-RPC implementation and did NOT touch it in the `018` commit.

The revert's incident note set two explicit preconditions for trying an RPC here again:
confirmed live in `pg_proc`, and Ayaan's explicit sign-off. Both are true now — `018` was
verified live earlier the same day, and Ayaan directly asked, in this same session, to
speed RugLens up too. `020` therefore drops the old, by-then-unused
`rug_lens_facets(boolean)` and replaces it with a 6-argument version
(`p_location`/`p_quality`/`p_size`/`p_item_type`/`p_search`/`p_include_held_or_assigned`)
that matches `applyRugLensFilters`/`listRugLensFacets`'s cross-filtering exactly: a `base`
CTE applies every condition shared by all three facets once, and each output array
(locations/qualities/sizes) is scoped by the OTHER two array filters only, never its own
— mirroring the app code so the two can't drift apart. SECURITY INVOKER (the default,
same as `018`'s three functions), so RLS is unaffected.

Verified live, twice, before touching the app code: a dry-run of the query body against
real data (23 locations / 177 qualities / 1,434 sizes with no filters — within normal
data-drift of `018`'s original same-day count of 178 qualities, not a logic error), and a
real cross-filter test (narrowing by one actual Quality value correctly shrank Locations
23→15 and Sizes 1,434→44, while the Qualities list itself stayed the full 177-value set —
confirming a facet never hides its own current selection's siblings, only reacts to the
other two). `get_advisors` clean (only the pre-existing, unrelated
`auth_leaked_password_protection` WARN). `listRugLensFacets` was then rewritten to call
this RPC in one round trip instead of three parallel paginated passes;
`packages/supabase-client/src/types.ts`'s `Functions` entry for `rug_lens_facets` was
updated to the new signature. Confirmed compiling clean via type-check and a full
production build before committing.

**NAV field expansion → column-request workflow (2026-09-12).** Direct request: "ITS
200+ COLOUMNS" (a real reference spreadsheet, `NAV FORMAT.XLSX`, listing 202 NAV
fields). Verified before writing anything: diffed those 202 against the 42 fields
`orders-sync.mjs` already pulls, then confirmed the remaining 160 against the LIVE
`NAV-002-Rug List - Main` view's real `INFORMATION_SCHEMA.COLUMNS` (read-only, from the
office server — the only machine with a route to it) rather than trusting the
spreadsheet's spelling — 225 real columns exist there today; 158 of the 160 matched
exactly (the other 2 don't exist in this view under that name), plus 22 more real
columns turned up that weren't even in the spreadsheet. `021_nav_full_field_expansion.sql`
captures all 180 verified fields as a ready-to-use migration — **written, deliberately
NOT applied**: Ayaan chose a request-based model instead ("no load in the server and
database instead only that column will be added which are required and requested by the
user"), so `022_column_requests.sql` (applied, advisor-clean — see below) adds a small
`orders_column_requests` table instead. An employee requests one specific field (browsed
from the full 180-field catalog, `apps/atlas/lib/requestableNavFields.ts`, via
`RequestColumnMenu.tsx`'s "Request a column" list next to the Orders table); the request
lands there for Ayaan to review on `/my-access` (admin-only, gated on the same
`orders.read.all` `requireAtlasStaffAccess.ts` already checks); only approved fields
actually get added — one small follow-up migration + one `orders-sync.mjs` field at a
time, copying that field's already-verified name/type straight out of `021`'s reference
rather than re-investigating it. Resolving a request (marking it added/declined) is a
plain admin action for now, not a second Edge Function/UI writer — v1 keeps that side
manual on purpose. New Edge Function `orders-request-column` (verify_jwt: true, same
"service-role client + `requested_by` always the CALLER'S OWN employee_id" pattern as
`salesperson-codes-add`), deployed and smoke-tested (no Authorization header → 401, the
expected rejection). `get_advisors` clean after `022` beyond the one pre-existing,
unrelated `auth_leaked_password_protection` WARN — the migration's own `unindexed_foreign_keys`
INFO finding (`resolved_by`) was fixed same-session with a follow-up index, not deferred.
`packages/supabase-client/src/types.ts` was also fully regenerated in this pass — its
header had said since 2026-08-19 that several orders-module tables were "hand-authored,
pending a migration that hasn't landed yet," which was already stale (that migration
landed long ago); this regeneration both adds real types for `orders_column_requests`
and finally corrects that stale note. Confirmed compiling clean across all four
consuming apps (atlas, hub, admin/feedback-app, admin/internal-portal) before treating
the regeneration as done, per AGENTS.md Section 4's "a shared package change... don't
land it without checking what else it touched."

**Branch divergence discovered and reconciled, `atlas-workflow-and-deploy` retired in
favor of `main` (2026-09-14).** While about to deploy the column-request work above,
Ayaan asked to check changes Vansh had made — turned out `main` and
`atlas-workflow-and-deploy` had silently diverged on 2026-09-10 (`91b5fe7`, their last
common ancestor) and never been reconciled: `main` gained Vansh's Orders UI redesign
(`c4ceb7b` — view tabs, filters moved into the table, a settings dropdown with Columns/
Filters/Row Height submenus, row height options, copy-OTN, a date-range picker; new
deps `@gravity-ui/icons` + `@internationalized/date`), while `atlas-workflow-and-deploy`
independently gained everything through `022` above. Neither branch had both. The
working directory switching branches mid-session also `git stash`'d uncommitted work in
progress at the time — nothing was actually lost, just needed recovering, all confirmed
present before continuing.

Reconciled by hand rather than trusting a mechanical `git merge` on `OrdersTable.tsx`
(rewritten heavily on both sides): took Vansh's version as the structural base, then
re-applied the column/data work on top of it — the full reordered/expanded column list,
`columnOrder` state, a search box + reorder buttons added to his "Hide Columns"
submenu, and "Request a Column" added as a fourth submenu alongside his existing three,
rather than as a separate button. `ColumnSettingsMenu.tsx`/`RequestColumnMenu.tsx`
(this session's earlier standalone versions) and `OrdersFilterPanel.tsx` (superseded by
filters-in-table) were all deleted as orphaned once their logic moved elsewhere and
confirmed nothing still imported them. Also fixed while reviewing: a leftover Chinese
character ("至", should read "to") in the new date-range picker's separator. Flagged to
Ayaan but deliberately not touched: the new icon library dependency reverses a
previously-recorded deliberate "no icon library" decision (`apps/atlas/components/shell/icons.tsx`'s
own prior comment) — AGENTS.md Section 1 territory, his call to make with Vansh, not
mine to override either way. Verified with a clean type-check and full production build
after every resolution step. Merged into `main` (fast-forward, since
`atlas-workflow-and-deploy` was reconciled first) and pushed both branches, now
pointing at the same commit (`d7c0b8c`).

**Working branch retired in favor of `main`, direct decision, same day.** Ayaan then
asked to make `main` the one shared working branch going forward ("so that we can work
combinedly" with Vansh) rather than maintaining two — done: local checkout switched to
`main`, and (a second direct instruction) the office server's deploy checkout switched
too (`git checkout main`, tracking `origin/main`), so `git pull` there now follows
`main` instead of `atlas-workflow-and-deploy`. Caught and fixed while deploying: Vansh's
commit had added `@internationalized/date` to `apps/atlas/package.json` but the
`pnpm-lock.yaml` update never got committed alongside it — invisible locally (a loose
`pnpm install`/`next build` resolves it from an already-hoisted copy without complaint)
but `pnpm install --frozen-lockfile` (what this office deploy, and presumably any
Docker-based CI-style install, actually uses) failed outright with
`ERR_PNPM_OUTDATED_LOCKFILE`. Fixed by regenerating the lockfile properly (both on the
office server and locally, to keep them identical) and committing the 3-line fix.
`deploy/atlas/office-deploy.md` updated to say `main`, not `atlas-workflow-and-deploy` —
see that file for the current deploy instructions; don't trust a cached mental model of
which branch is live there without checking `git branch -vv` on the box itself first.
The VPS (`deploy-atlas.bat`) was not touched by this rename — it builds from whatever's
on the local disk of whoever runs it, not from a git pull, so it has no branch to be
wrong about; it just needs `main` checked out locally (or the equivalent working tree)
next time someone runs it, same as any other local build.

**Per-account view preferences + real column-request approval — written, NOT yet
applied/deployed (2026-09-14, `023_user_view_preferences_and_request_approval.sql`).**
Three direct follow-ups on the same day's earlier column-request work: (1) "lock the
user's view acc to their user id... from any system" — Orders view preferences (shown
columns/order/hidden filters/row height) move off browser localStorage onto a real
per-employee table (`user_orders_view_preferences`, RLS-scoped SELECT, written to
through a new self-service Edge Function `orders-save-view-preferences`); (2) "admin
will approve it" — `column_request_status` gains `'approved'` as its own status,
distinct from `'added'` (approving is a real decision recorded immediately via a new
admin-only Edge Function `orders-resolve-column-request`; actually making the field
exist is still a real migration + `orders-sync.mjs` update + deploy, not something a
click safely automates for a live sync — same reasoning `022`'s own header already
gives); (3) "request... from a search and dropdown option" on `/my-access` specifically
— `RequestColumnForm.tsx` moved the request UI off `OrdersTable.tsx`'s settings
dropdown onto that page. A fourth ask the same message, drag-to-reorder columns, was
added as native HTML5 drag-and-drop alongside (not replacing) the existing up/down
buttons.

**Blocked mid-session**: the Supabase MCP connection dropped partway through this
session (visible as a tool-availability change, not an error from any specific call) —
neither `apply_migration` nor `deploy_edge_function` has been reachable since, so `023`
is unapplied and both new Edge Functions are undeployed as of this entry.
`packages/supabase-client/src/types.ts` hand-authors `user_orders_view_preferences`
and the `'approved'` enum value in the meantime (flagged explicitly at that file's own
header, same pattern already used once before in this ledger for exactly this
situation) — regenerate and replace once `023` actually lands. Confirmed compiling
clean (type-check + full build, all four consuming apps) regardless, so this is
ready to activate the moment the connection comes back: apply `023`, deploy both
functions, done — no further code changes needed at that point.

**Orders tab bar relabeled, "Late" tab deliberately left disabled pending a SQL port
(2026-09-14/15, `024_on_time_status_view.sql`).** Direct request: replace the top tab
bar (All Orders/Delayed/On Hold/Quick Ship) with All Orders/Late/Delayed/On
Track/Due in 7 days. On Hold and Quick Ship weren't dropped, just demoted to the filter
bar below (unchanged filters, just no longer a top-level tab). Delayed and Due in 7
days are unchanged under the hood (`delayStatus=late`/`soon` — plain
`revised_ex_factory_date` comparisons); On Track is a new, simple date-window
`delayStatus` value ("not late, not due soon," a missing date counts as on_track too) —
neither needed a migration.

"Late" is different in kind, not just degree: confirmed directly (asked explicitly
whether it should just mean the same thing as "Delayed" — no, it's the real
pace-projection warning this app's own "On Time" column already computes per row, from
a real 2026-09-07 production conversation: "flag it as Late not delayed"). Computing
that correctly across the full 13,685+-row dataset (not just whichever page happens to
be loaded) means porting `apps/atlas/lib/stageTat.ts`'s `stageStandard`/
`loomStandardDays`/`maxDimensionFt` + `lib/tat.ts`'s `onTimeStatus` into Postgres —
`024` does that: `private.zero_priority_knotted_rate` (a real reference table for the
per-quality knot rate lookup — the exact thing `stageTat.ts`'s own header comment said
this data should eventually become), three `private` helper functions, and a
`security_invoker` view, `orders_with_on_time_status`, exposing `orders`'s columns plus
`computed_stage_standard_days`/`computed_on_time_status`. **Written, NOT applied** (same
blocked Supabase connection as `023` above) **and, even once applied, the frontend
"Late" tab must NOT be wired to it until
`apps/atlas/scripts/validate-on-time-status-port.mjs` has actually been run and passed**
— it re-implements the exact same TS logic in the script itself and diffs it against
the SQL view's output for every real order, not a sample; zero mismatches is the bar. A
regex/lookup-table port like this is exactly the kind of change that can look correct
under code review and still be subtly wrong on real data (an ERP quality/size string
this app hasn't seen a clean example of yet, a POSIX-vs-JS regex edge case, etc.) —
this is a live TAT tool 124 people use for real decisions, so "written carefully" isn't
being treated as equivalent to "verified," and the tab stays visibly disabled with an
explanatory tooltip in the meantime rather than silently wrong or silently missing.

**`023` and `024` applied 2026-09-15**, via the other Supabase-connected session
(handed the exact SQL/function file paths + project id, applied verbatim, nothing else
touched — confirmed by its own report back). Both Edge Functions
(`orders-save-view-preferences`, `orders-resolve-column-request`) deployed and
confirmed `ACTIVE`. Advisors clean for `023`. `024` surfaced one real WARN
(`function_search_path_mutable` on all 4 new `private` functions) — same finding, same
fix, as `007_hub_advisor_fixes.sql`/`008_driver_code_helper_fixes.sql` before it.

Running `validate-on-time-status-port.mjs` (from this session, via SSH to the office
server — it holds the real `SUPABASE_SERVICE_ROLE_KEY`, the other session's own local
`.env.local` didn't) caught a second, more important problem before either the WARN or
this ledger entry existed: nobody could query `orders_with_on_time_status` at all —
`permission denied for schema private` (`42501`), even for `service_role`. A view's own
SELECT-list function calls need the querying role to hold real `EXECUTE` on them
(unlike an RLS policy predicate's function calls) — `private` schema functions get none
by default, which is the whole point of that schema, but it meant the view was
unusable as built. `025_on_time_status_fixes.sql` grants exactly the `EXECUTE` (and
`USAGE ON SCHEMA private`) those 4 functions need, plus the `search_path` fix — written,
not yet applied. Once it lands, `validate-on-time-status-port.mjs` needs a clean run
before the frontend "Late" tab gets wired up — still the actual bar, not "025 applied."

**`025` applied 2026-09-15** (via the other session again — advisors confirmed the
`function_search_path_mutable` WARN gone, nothing new). Re-running
`validate-on-time-status-port.mjs` got further but hit a second, different permission
gap: `permission denied for table zero_priority_knotted_rate` — `loom_standard_days()`
reads that table directly, and same reasoning as `025`, a plain reference table grants
nothing to anyone but its owner by default. `026_on_time_status_table_grant.sql`
(`grant select ... to authenticated, service_role`) fixed it — Postgres's own error
message named the exact fix needed.

**`026` applied 2026-09-15. Third re-run of the validation script actually executed
(no more permission errors) and found a REAL correctness bug** — not a permissions gap
this time. `computed_stage_standard_days` matched the TypeScript on every single row
checked (confirming the `stageStandard`/`loomStandardDays`/`maxDimensionFt` port is
correct), but `computed_on_time_status` disagreed on a large fraction of rows, in two
consistent, explainable directions: an order due exactly today came back
`js=delayed`/`sql=late`, and an order due in the next few days sometimes came back
`js=late`/`sql=on_track`. Root cause: `lib/tat.ts`'s `onTimeStatus()` compares real
instants (`Date.now()` vs. `new Date("yyyy-mm-dd").getTime()`, always midnight UTC of
that date) — `024`'s SQL instead compared plain `date` values, a whole day "behind" at
the boundary, since at any point after midnight UTC on the due date (i.e. essentially
always, during normal daytime hours) JS has already crossed that instant and calls it
delayed, while `current_date > v_target` is still false when the two dates are equal.
`027_on_time_status_timestamp_fix.sql` replaces the date-only comparison with real
`timestamptz` arithmetic, explicitly anchored to UTC (`AT TIME ZONE 'UTC'`, not trusting
the session timezone to already be UTC) — written, not yet applied. Re-run the
validation script again once it lands; a second full pass with zero mismatches is still
the bar, not just "the obvious two are fixed" — a regex/date port producing two
distinct, explainable-in-hindsight bugs on the first real run is exactly why this
process insisted on checking every real order rather than a sample or a code read.

**`027` applied 2026-09-15 — and the advisor check (run after every migration this
session, no exceptions) caught a regression from it immediately.** `function_search_path_mutable`
came back, this time only for `private.orders_on_time_status`: `create or replace
function` does NOT preserve a prior `alter function ... set search_path`, so `027`'s
replace (needed to fix the timestamp bug) silently dropped `025`'s pinning on that one
function. `028_on_time_status_search_path_regression.sql` re-pins it — a real,
worth-remembering gotcha for any future `create or replace function` on an
already-pinned function in this project, not just this one. Advisors otherwise
unchanged both times (the two pre-existing, unrelated findings only). Written, not yet
applied; the validation script re-run is still the actual thing that decides whether
the frontend "Late" tab gets enabled, not any individual advisor check on its own.

**`028` applied 2026-09-15, advisors confirmed back to baseline. Validation script
re-run: PASS — 0 mismatches across 13,739 real orders.** That's the actual bar this
whole `024`-`028` sequence was built around, not any individual migration landing —
"Late" wired up the same day: `listOrders()` now queries `orders_with_on_time_status`
instead of the bare `orders` table (same RLS via `security_invoker`, plus the two
computed columns), a new `onTimeStatus` filter dimension (deliberately separate from the
existing date-only `delayStatus` one — "Late" and "Delayed" are genuinely different
things here, not two names for the same filter), and the tab bar's "Late" button went
from a disabled placeholder to a real one. Sanity-checked against live counts before
calling it done: 706 orders (of ~13,573 non-stock, non-terminal) currently show "late" —
not past due yet, off-pace given their stage's TAT standard; 9,674 "delayed", 3,176
"on_track", 17 "unknown". Confirmed compiling clean (type-check + full build), deployed
to the office server, verified healthy (307 on `/` and `/orders`, clean logs beyond the
routine, pre-existing, unrelated auth-refresh-token noise every Supabase Auth app gets
from expired browser sessions).

The whole `023`-`028` sequence is worth reading end to end for anyone touching this
pattern again: two permission gaps (`EXECUTE` on the `private` functions, `SELECT` on
the reference table — neither is granted by default, and neither shows up until
something outside the function owner actually tries to query through the view), one
real correctness bug (date vs. timestamp comparison, exactly the kind of boundary error
that reads fine on inspection and is wrong against real data), and one regression
(`CREATE OR REPLACE FUNCTION` silently drops a prior `ALTER FUNCTION ... SET`) — four
distinct problems, caught in order, only because `validate-on-time-status-port.mjs` and
`get_advisors` were run after every single migration rather than once at the end.

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

`db/orders/001`–`006` are applied and advisor-clean (see the module paragraph above). All
10 Edge Functions (there are 10, not 9 — an earlier count in this file was off by one:
`orders-sync`, `orders-update-stage`, `orders-set-shipping-detail`, `merchants-invite`,
`merchants-link-clerk-account`, `orders-create-request`, `orders-action-request`,
`orders-mark-request-seen`, `orders-record-milestone`, `orders-escalate-order`) are
deployed (2026-08-27) and `ACTIVE`, smoke-tested with real HTTP calls (each one's own
auth gate returns the expected error for a request that shouldn't be let through — not
just "the deploy call returned success"). `supabase/config.toml` also picked up explicit
`verify_jwt` entries for the five functions that were missing them (functionally the CLI
default already matched — `true`, since all five expect a real employee session — this
just closes a documentation gap matching every other function's explicit entry).

**Admin role extended (2026-08-27):** the existing `Admin` role (bound to `vansh.g@pixxeldigital.com`, `PIX-001`, since the Hub module's original seed) did not automatically pick up `orders.read.all`/`orders.write.all` when `001` added them — Hub's original seed was a one-time "bind to every permission that exists right now," not an ongoing auto-bind. Explicitly granted both to `Admin` via a plain `role_permissions` insert, confirmed by the user, so that account can actually see/manage orders once real data exists. As of the same check: `orders` has 0 rows (`orders-sync` has never run), `merchants` has 0 rows (deliberately unseeded), and of the 3 employees with a completed signup, only `shipping@jaipurrugs.com` (a `shipping` department grant) passed the staff gate before this change — `Admin` now does too. Ayaan's own admin account (`EMP-011`, `ayaan.k@jaipurrugs.com`) was created the same way on 2026-09-01 via a direct `employee-signup` call (Hub itself was never deployed to the pilot server — see below), bound to the same `Admin` role.

**Merchant auth consolidated onto Supabase Auth (2026-09-01, `006_merchant_auth_consolidation.sql`):** "merchants" turned out to mean internal Jaipur Rugs territory heads/B2B salespeople, not external customers — the real trigger was setting up Dinesh Choudhary (`dinesh.c@jaipurrugs.com`, territory head, 72 real ERP customer codes cross-checked against the live feed) and discovering the Clerk-based merchant login was broken in two independent, unfixable-from-this-session ways: `CLERK_SECRET_KEY` was never set as an Edge Function secret, and Clerk was never configured as a Supabase Third-Party Auth provider either. Rather than fix both, removed the whole second auth system: the `merchants` table is dropped, `merchant_customer_codes` now links directly to `employees` (nullable `employee_id` until that person actually signs up — same pattern as `escalation_levels.notify_employee_id`), `can_view_order()`'s merchant branch matches the caller's own employee id instead of a Clerk JWT, `apps/atlas/app/merchant/*` and `lib/merchant/*` are deleted, `merchants-invite` now grants an *existing* employee visibility into customer codes (no account creation), and `merchants-link-clerk-account` is retired as a static 410 stub (no delete-function tool available in this session). Dinesh's 72 codes are seeded but `employee_id` is still null for all of them — **he needs to sign up via the normal `employee-signup` flow (same as everyone else) before his access actually works**; nothing auto-links him.

**ERP sync pipeline resolved, then moved off Edge Functions entirely (2026-09-02).**
What was "Set `ORDERS_SYNC_SECRET`" below turned out to have no path forward via any
tool in this session (no MCP tool sets project-level Edge Function secrets, and none
ever will by design) — worked around via `007_orders_sync_secret_rpc_bridge.sql`
(Postgres Vault + a `service_role`-only RPC bridge) instead, needing no Dashboard visit.
`orders-sync` was then redeployed with a stream-parser rewrite to fix a real
`WORKER_RESOURCE_LIMIT` failure on the ~120k-row/~145MB live feed — but a real
invocation still failed the same way, twice, at a near-identical ~9.5s mark. That
repeatability means it's a fixed platform ceiling (Edge Functions aren't sized for a
pull this large), not a fixable inefficiency, so `008_orders_sync_move_to_server.sql`
un-scheduled the pg_cron job entirely and the same logic now runs as a plain Node
script on the app server itself (`apps/atlas/scripts/orders-sync.mjs`, invoked by a
system cron entry there — a real machine has no such ceiling). The Edge Function stays
deployed (harmless) for manual/small-feed use only.

**`/orders` timeout, confirmed and fixed (2026-09-02, `009_orders_select_perf_fix.sql`).**
The very first real page load against real data (14,214 rows) hit a Postgres statement
timeout, confirmed via `pm2`'s error log (`{"code":"57014",...,"message":"canceling
statement due to statement timeout"}`). Cause: `orders_select`'s policy called
`private.can_view_order(id)` — an opaque function Postgres must invoke once per
candidate row — whose "coarse" checks (admin permission, department access) don't
depend on the row at all, yet were being fully re-derived (several joins) for every one
of 14,214 rows before the `limit 500` could even apply. Fixed by giving `orders_select`
its own policy that reads the row's own `salesperson_code`/`customer_no` columns
directly and wraps every row-independent check in `(select ...)` so Postgres treats it
as an InitPlan (evaluated once, not per row) — confirmed via `EXPLAIN ANALYZE` under a
simulated real session: total execution time **9.6ms**, with the salesperson/merchant
branches showing `never executed` (short-circuited once the hoisted admin check came
back true). Also added `orders_updated_at_idx` — the list view's `order by updated_at
desc` had no supporting index.

**Self-service salesperson codes (2026-09-02, `010_salesperson_codes_self_service.sql`).**
Asked directly: "mapping each sales person with the respective sales code is not
possible" — confirmed by checking the real data (some ERP `Salesperson Code` values
cover thousands of orders across several different client accounts, so they don't even
map cleanly to one person each). There is no field in the ERP feed that ties a code to
a real name, so no admin-compiled mapping was ever going to work. Fixed by generalizing
`employees.salesperson_code` (a single nullable column, 0 rows ever used it) into
`employee_salesperson_codes`, the same one-to-many shape `merchant_customer_codes`
already uses for Dinesh's case — a person adds their own already-known code(s)
themselves from a new `/my-access` page (or optionally at sign-up), through a new
`salesperson-codes-add` Edge Function that only ever writes to the CALLER'S OWN
employee_id. No approval step (explicit product decision — the underlying order data
isn't confidential between salespeople in the first place), matching exactly how the
pre-Atlas tool at ai.jaipurrugs.com/track-jr-order/ already treats a salesperson's login
code as identical to their ERP salesperson code. `proxy.ts` and
`requireAtlasStaffAccess.ts` both needed a real fix alongside this (not just the swap):
they were still selecting the now-dropped `employees.salesperson_code` column, which
would have 500'd on every request — caught before deploying, not after.

Still required before this module is actually usable end-to-end:
- Confirm `apps/atlas/scripts/orders-sync.mjs` has actually run successfully at least
  once on the server (real orders populating the `orders` table) and that its cron
  entry is in place — see the script's own header for the exact command.
- Link Dinesh Choudhary's `merchant_customer_codes` rows to his real `employee_id` once
  he signs up (see above) — a one-line `update` by email match, same as `006`'s backfill.
- Regenerate `packages/supabase-client`'s types — the current `types.ts` has a
  hand-authored section for this module, clearly flagged at the top of the file, standing
  in until then.

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

**Back Ops opened up beyond the pilot (2026-09-10, `017_backops_department_self_service.sql`)
— supersedes the single-person pilot scope above for department membership specifically.**
Requested directly: register "Back Ops" as a real department, and let Back Ops staff
self-add their own codes instead of an admin manually seeding each of the remaining six
people. Two changes, both live:

1. `departments` gained `Back Ops` / `backops` (idempotent insert, safe to re-run).
   `join-department`'s self-service allow-list gained `"backops"` alongside
   `management`/`production` — a Back Ops employee can now pick it at sign-up like any
   other self-service department. Unlike `management`/`production`, `backops` was
   deliberately **not** added to `private.has_blanket_orders_access()` or
   `private.can_view_order()`'s blanket department list — joining it only marks org
   placement, it grants zero order visibility by itself. This keeps the pilot's
   per-code, deny-by-default posture intact while still letting people identify their
   department.
2. **New Edge Function `customer-codes-add`** — the missing counterpart to
   `salesperson-codes-add` (010). Diagnosed a real reported bug: pasting a customer code
   (e.g. `24523`, `34836`) into whatever "add my code" UI exists today silently inserted
   it into `employee_salesperson_codes` (the only self-service endpoint that existed),
   which never matches `orders.salesperson_code` — so it looked broken, while
   SALES-XXXX-style codes worked fine through the same path. The schema/RLS side needed
   **no changes at all** — `orders_select`/`can_view_order` already OR in a
   `merchant_customer_codes` match, and its unique index
   (`merchant_customer_codes_employee_customer_idx` on `(employee_id, customer_no)`
   where `employee_id is not null`) already existed, ready for exactly this upsert
   pattern. The only gap was the missing endpoint; this closes it. Each Back Ops
   employee now adds exactly the customer code(s) and/or salesperson code(s) they
   personally need via these two functions — nobody is hard-coded a default bundle
   (e.g. all four Back Ops codes) anywhere.

**Not done in this pass, flagged for whoever owns the actual Atlas frontend** (its source
lives at `G:\Automation\MonoRepo\jaipur-rugs\`, github.com/Vansh0508/jaipur-rugs,
branch `main` as of 2026-09-14 — see this file's own later entry on the
`atlas-workflow-and-deploy` -> `main` branch reconciliation; same repo as this worktree,
just possibly a different checkout/session): the "my access" page still needs a **Customer code(s)**
input wired to `customer-codes-add`, distinct from the existing **Salesperson code(s)**
field wired to `salesperson-codes-add` — right now nothing in the frontend calls the new
function yet. Also requested but out of reach from a database-only session: trimming the
department dashboards (open requests, delay alerts, escalation counter, live queue, the
order-punch/warehouse/QC/PSFT request-filing UI) back down to plain order-tracking only,
for every department, with the rest explicitly deferred to a later phase — that's a
frontend layout decision with no database component, so it isn't reflected here.

**Jaipur Living (JLI) department + department-scoped customer codes (2026-09-17,
`033_jli_department.sql`, `034_jli_department_customer_codes.sql`,
`035_jli_department_customer_codes_policy_fix.sql`) — new pattern, not a copy of Back
Ops.** Requested directly after a JLI team meeting about a dashboard for JLI order/sample
tracking (transcript saved by Ayaan in his Rug Tracker working folder, not this repo).
Numbering note: `033` was originally written and applied as `032_jli_department` (visible
under that name in Supabase's own migration history) before a same-day numbering
collision was noticed against `032_orders_filtered_summary_rpc.sql` — a *different*,
concurrent, uncommitted session editing this exact repo checkout at the same time (see
below). Renamed to `033` on disk; not worth re-applying under a new name in Supabase for
a same-content insert.

1. `departments` gained `Jaipur Living` / `jli` (idempotent insert). Deliberately **not**
   added to `has_blanket_orders_access()`/`can_view_order()`'s blanket list, and **not**
   added to `join-department`'s `SELF_SERVICE_DEPARTMENT_CODES` — same non-blanket
   posture as Back Ops, but the membership model itself is different (next point).
2. **New table `department_customer_codes`** (department_id, customer_no) — the actual
   new pattern. Back Ops requires each employee to self-add their own known code(s) via
   `salesperson-codes-add`/`customer-codes-add`; Ayaan's explicit ask this time was that
   selecting "Jaipur Living" should surface a **pre-set list of codes automatically**,
   department-wide, and that adding/removing a code from the department should apply
   live to every current member — so this is a table `orders_select`/`can_view_order`
   join through `department_access_grants`, not a one-time copy into
   `employee_salesperson_codes`/`merchant_customer_codes` at join time. Seeded for `jli`:
   **1081** (737 live orders), **108000** (64), **0180** (95), **0108** (3,391), **0322**
   (2,922) — all five confirmed as real, currently-syncing `orders.customer_no` values,
   both against live data and against the raw NAV-002 Rug List Main.xlsx export Ayaan
   shared directly (a first pass on this same request had wrongly reported most of these
   codes as not existing in Atlas at all — they exist; they just aren't order-type codes,
   they're ERP customer numbers).
3. `035` is a same-day advisor fix: `034`'s `department_customer_codes_write` policy used
   `for all`, which Postgres's RLS also applies to SELECT — flagged as
   `multiple_permissive_policies` (two permissive SELECT policies on one table) since it
   overlapped with the dedicated `department_customer_codes_select` policy. Split into
   separate insert/update/delete policies instead. (`departments_write` in the original
   `001` schema has this identical latent issue, pre-existing and untouched here — not
   this migration's scope to fix.)
4. **`apps/atlas/lib/auth/requireAtlasStaffAccess.ts` updated in the same pass** (plain
   code change, no migration file): its `isAuthorized` check previously had no way to
   know about department-granted codes, so a Jaipur Living employee with zero personal
   `merchant_customer_codes`/`employee_salesperson_codes` rows would have been bounced to
   `/my-access` despite `034` giving them real RLS-level access — added
   `hasDepartmentCodeGrants` (true if any department the employee holds a
   `department_access_grants` row for has rows in `department_customer_codes`) alongside
   the existing checks. Also broadened the department-grants query this function already
   ran (previously filtered to `ATLAS_DEPARTMENT_CODES` only) to fetch every department
   grant, reusing one round trip rather than adding a second, since `jli` isn't and
   shouldn't be in that blanket-access list.

**Follow-up, same day (2026-09-18), once the concurrent session's work had landed
(`5a63882`, "Orders: filter-aware summary panel"): the two gaps above are now closed.**

- **`packages/supabase-client/src/types.ts` updated by hand** with a
  `department_customer_codes` table entry (Row/Insert/Update/Relationships, matching the
  file's existing style) — not a full `generate_typescript_types` regen, since the file
  is large and hand-maintained in places; verified with `tsc --noEmit` on the file
  directly rather than trusting it silently. `orders_with_on_time_status` was already
  untyped in this file before today (the view isn't represented in `Database` at all —
  `apps/atlas/lib/queries/orders.ts` deliberately uses a plain, un-generic'd
  `SupabaseClient` — see that file's own top-of-file comment), so the new
  `is_hidden_stock` column below needed no type change to be usable.
- **0108 and 0322 now actually appear for Jaipur Living (`036_jli_stock_code_visibility.sql`).**
  New helper `private.employee_has_explicit_customer_code(text)` — true if the calling
  employee has an explicit grant for that exact `customer_no`, direct
  (`merchant_customer_codes`) or via department (`department_customer_codes`, 033/034).
  `orders_with_on_time_status` (024) gained a computed `is_hidden_stock` column built from
  it; `orders_list_facets()`, `orders_dashboard_stats()`, and `orders_filtered_summary()`
  (032, from the now-landed concurrent session) each got the same carve-out folded into
  their existing stock-exclusion `where` clause. `apps/atlas/lib/queries/orders.ts`'s
  `applyOrderFilters()` was updated to filter on the new `is_hidden_stock` column instead
  of a flat `.not("customer_no", "in", STOCK_CUSTOMER_CODES)` — same outcome for everyone
  without an explicit grant on 0108/0322 (still hidden), different only for employees who
  now resolve access to those two codes via Jaipur Living. `STOCK_CUSTOMER_CODES` itself
  is untouched and still used as-is by RugLens (`lib/queries/rugLens.ts`, which
  deliberately queries *within* those 5 codes for physical stock tracking — the opposite
  use case) and by the two offline scripts (`orders-delay-alerts.mjs`,
  `validate-on-time-status-port.mjs`) — neither runs with a specific employee's session,
  so the new per-employee carve-out doesn't apply to them and wasn't extended there;
  delay-alert emails for 0108/0322 orders staying suppressed org-wide was not part of
  this request.
- Advisor-clean both times (`get_advisors` security + performance) — no new findings
  from either `034`/`035` or `036`.
- **Still genuinely open, unrelated to the above:** no employee has actually been added
  to the Jaipur Living department yet (034's codes exist and the RLS/display path all
  works, but `department_access_grants` has zero rows pointing at `jli` — someone needs a
  name/email before this is usable end-to-end for anyone).

## CAD Layout module — WRITTEN, NOT YET APPLIED (2026-09-18)

`db/cad-layout/001_cad_layout_schema.sql` (+ `cad-layout-schema.mmd`) backs
`apps/DND/CAD Layout`. It is on disk only — not applied to `matnispbauvvlnbsuzxq`, no
advisor run, no types regenerated. The app currently works without it (generated decks
live in a per-job temp folder); the migration adds the record/option/colour tables, the
`cad-layout` app row, the `cad_layout.admin` permission, a `dnd` department row, the
PRIVATE `cad-layout-files` Storage bucket (recorded override of the self-hosted-S3
default — private, unlike `driver-photos`/`employee-avatars`, because the raw Tikni BMP
must never be URL-reachable), read-only RLS (creator sees own, admin sees all) and the
`cad_layout_usage_view`. Apply → advisors → log the version here → regenerate
`packages/supabase-client` types → then build the Edge Functions
(`cad-layout-create-record`, signed uploads) — see `apps/DND/CAD Layout/README.md`.

## Employee login simplified to code-only (2026-09-25) — code change, no schema change

Feedback App employee tab: further simplified beyond the `employee_code` + phone match
this section already covers (see "Employee login redesign" and "Employee sign-in recovery
cascade" above) — employees now type **only** their `employee_code`, matched as-is against
`employees.employee_code` (still `.toUpperCase()`-normalized, still gated on
`status = 'active'`). No phone, no email, and therefore no recovery cascade at all: a code
that matches nothing (or matches an inactive row) is a flat
`"No active employee matches that employee code."` rejection, same message either way
(deliberately not revealing which case it is, same principle the old wrong-phone rejection
used). `employee-signin` no longer creates or patches any `employees` row — that
capability only existed to back the phone/email recovery steps, which are gone; new
employees still come from `apps/hub`'s HR-driven `invite-employee`/onboarding flow.

No `db/feedback/*.sql` file — `employees.employee_code`/`status` and `feedback.employee_id`
already existed (`006_employee_code_phone_login.sql`), so there's no schema to migrate,
only edge-function and frontend logic. Guest login (`guest-signup`, full name + phone) is
untouched.

**Files changed:** `supabase/functions/employee-signin/index.ts` (rewritten — code-only
lookup, no phone param, no cascade branches), `packages/db-management-client/src/index.ts`
(`EmployeeSignInInput` now just `{ employeeCode }`; `EmployeeNotFoundError`/
`EmployeePhoneMatchPendingError`/`EmployeeEmailNotFoundError`/`EmployeeEmailMatchPendingError`
and the `action` param removed — `employeeSignIn` now throws a plain `Error`),
`apps/admin/feedback-app/app/login/page.tsx` (`EmployeeLoginForm` down to a single
Employee Code field, no more recovery `Modal`).

**Deployed** the same day via `deploy_edge_function` against `matnispbauvvlnbsuzxq` —
`employee-signin` is now version 9 (`verify_jwt: false`, unchanged from version 8), live
and `ACTIVE`. Confirmed by re-fetching version 8's body first (still the old
`employeeCode`+phone code, `"employeeCode and phone are required"` on a code-only
request — this is the exact error a real employee hit, which is what triggered the
redeploy) before pushing the rewritten version. No schema/RLS touched, so no advisor
re-run was needed.
