# Internal Portal — Build Status (2026-08-18)

Feature is **complete and browser-verified end-to-end** against the live Supabase project.
See `C:\Users\vansh.g\.claude\plans\i-want-to-start-zany-balloon.md` for the original
approved plan this work follows.

## ✅ Completed

### Database (applied to `matnispbauvvlnbsuzxq`, fully tested)

- New module `db/journeys/001`–`008` (+ `db/team-members/004_seed_admin_departments.sql`,
  `005_fix_employees_select_recursion.sql`):
  - `vehicles` extended with `name`/`status`/`qr_code_url`; `drivers.phone` mandatory +
    E.164-checked; `driver_code_seq` for new drivers.
  - New tables: `journeys`, `journey_guests`, `journey_stops`, `journey_stop_guests`.
  - **Car/driver double-booking guarantee**: two Postgres `EXCLUDE` (GiST) constraints on
    a generated `busy_window` range. Verified via direct SQL, real HTTP calls, AND a real
    browser submission — overlap correctly rejected (409), a booking starting after a
    prior one's last drop correctly succeeds, the origin-pickup-only/destination-drop-only
    trigger correctly rejects malformed routes.
  - `feedback` extended with `journey_id`/`review_status`/`reviewed_by`/`reviewed_at` for
    the planned-vs-unplanned moderation split.
  - Authorization primitive `private.is_internal_portal_admin(emp_id)`. RLS on every new
    table (+ `guests`) gated to it; no INSERT/UPDATE policy anywhere — all writes go
    through `create_journey`/`update_journey` (service-role-only SQL functions) or a
    service-role Edge Function.
  - **Fixed a pre-existing bug**, found via browser testing, not advisors: `employees_select`'s
    RLS policy had an inline subquery against `employees` causing infinite recursion
    (`42P17`) the moment any app queried `employees` under a real session with RLS —
    latent since `002_advisor_fixes.sql` (2026-08-17), never triggered because no app
    before this queried that table with a real session. Fixed with a SECURITY DEFINER
    helper (`private.current_employee_department_id()`), same pattern as the sibling
    helpers already in that file.
  - Security advisors clean (only the pre-existing, out-of-scope
    `auth_leaked_password_protection` project setting remains).
  - `db/MIGRATIONS.md` and `packages/supabase-client/src/types.ts` updated/regenerated.
    `db/journeys/journeys-schema.mmd` ERD written.

- **Demo admin user**: `vansh.g@pixxeldigital.com` / `Vansh@123` — department `Pixxel`,
  `department_access_grants` admin grant on department `admin`. Verified live via a real
  browser login.

### Edge Functions (deployed, smoke-tested via real HTTP AND exercised through the actual UI)

`create-car`, `update-car-status`, `create-driver`, `create-journey`, `update-journey`,
`cancel-journey`, `approve-feedback`, `upload-driver-photo`, and the extended
`submit-feedback` (v3, supports `journeyId`) — all under `supabase/functions/`, sharing
`_shared/authz.ts`. `packages/db-management-client` has typed wrappers for all of them,
including `JourneyConflictError` and `uploadDriverPhoto`.

### Frontend — `apps/admin/internal-portal` (built AND browser-verified)

Full app: scaffold, auth (`proxy.ts` + `requireInternalPortalAccess`), navigation shell,
Dashboard, Journeys (list + filters + full New Journey form + detail + cancel), Cars
(list + add + detail + QR slot + status toggle), Drivers (list + add w/ photo upload +
detail + rides + planned/unplanned feedback approval). `packages/ui-kit` gained
`DateRangeField`, `ImageUploadField`, and a `StarRating` `isReadOnly` mode.

**Verified live in a real Chromium browser (Playwright), against the actual running app
and the actual Supabase project — not just `next build`/`tsc`:**
1. Logged out → `/` redirects to `/login`. ✓
2. Login as the demo admin → lands on `/dashboard` with the sidebar (all 4 tabs). ✓
3. All 4 nav pages render with no console/page errors. ✓
4. Cars: "Add car" → new car appears in the grid. ✓
5. Drivers: "Add driver" → new driver appears in the grid. ✓
6. Journeys: full "New Journey" submission (guest, origin/stop/destination with
   pickups/drops, car+driver availability picker) → real journey created, redirected to
   its detail page, route/car/driver/guest all rendered correctly. ✓
7. Car detail: "Send for maintenance" → confirm in `AlertDialog` → status updates to
   Maintenance; "Mark vacant" reverts it. ✓
8. Driver detail: an unplanned (`journeyId`-less) feedback submission via `submit-feedback`
   correctly starts `pending`; "Approve" in the driver detail page correctly moves it out
   of the pending list via `approve-feedback`. ✓

**Two real bugs found by this browser testing and fixed (not found by `tsc`/`next build`,
which both passed cleanly beforehand):**
- The `employees_select` RLS recursion above (DB-level fix).
- `AlertDialog.CloseTrigger` wrapping a `<Button>` produced invalid nested `<button>`
  HTML → a hydration warning. Fixed in `CancelJourneyButton.tsx` and
  `CarStatusControls.tsx` by using the documented `AlertDialog.Dialog`'s `({ close }) =>`
  render-prop instead of `CloseTrigger` for anything beyond a bare icon-close button.

All test data created during verification (test cars/drivers/journeys/feedback/guests)
was deleted afterward — the database is back to its pre-testing state plus the intended
demo admin user.

## Notes for whoever picks this up next

- The dev server was stopped after verification. To run it again:
  `pnpm --filter @jaipur-rugs/internal-portal dev` (needs `.env.local` — a real one exists
  in the app folder locally, pointed at the live `matnispbauvvlnbsuzxq` project; it is
  **not** meant to be committed).
- `next lint` has not been run against the new app — only `tsc --noEmit` and `next build`,
  both clean.
- No `supabase/functions/_shared/authz.ts` deploy step is needed on its own — it's bundled
  into every function that imports it at deploy time; if you edit it, redeploy every
  function that uses it (see the deploy calls' `files` arrays for the exact pattern).
- `vehicles.qr_code_url` remains unpopulated for all cars — the QR-generation endpoint is
  explicitly deferred per the original spec; `QrCodeSlot.tsx` already has the "coming
  soon" / loaded states wired for whenever it exists.
