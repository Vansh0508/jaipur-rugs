-- Conference module, file 2/2. Row Level Security — designed alongside the schema
-- (AGENTS.md Section 3.1 step 4), applied right after 001.
--
-- Who can SELECT: Internal Portal admins only (an active employee with an admin-level
-- department_access_grants row on the 'admin' department) — the single authorization
-- primitive for this portal, db/journeys/003. Who can write: nobody through PostgREST.
-- There is deliberately no INSERT/UPDATE/DELETE policy on either table; every write goes
-- through a service-role Edge Function that re-checks the same admin primitive
-- (supabase/functions/_shared/authz.ts → requireInternalPortalAdmin).
--
-- The helper calls are wrapped in (select ...) so Postgres evaluates them once per
-- statement instead of once per row (auth_rls_initplan advisor).

alter table conference_rooms enable row level security;
alter table conference_bookings enable row level security;

create policy conference_rooms_select_admin on conference_rooms for select to authenticated
  using ((select private.is_internal_portal_admin((select private.current_employee_id()))));

create policy conference_bookings_select_admin on conference_bookings for select to authenticated
  using ((select private.is_internal_portal_admin((select private.current_employee_id()))));
