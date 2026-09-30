-- Booking-requests module, file 2/3. Row Level Security — designed with the schema
-- (AGENTS.md Section 3.1 step 4).
--
-- Who can SELECT: Internal Portal admins only — the same primitive as the conference and
-- journeys modules (private.is_internal_portal_admin, db/journeys/003). The employee portal
-- has no session, so `anon` reads nothing here; it gets the few things it needs through its
-- own Edge Functions. Who can write: nobody through PostgREST — no INSERT/UPDATE/DELETE
-- policy. Requests are created by conference-request-create / journey-request-create and
-- decided by conference-request-decide / journey-request-decide (service role).
--
-- Helper calls wrapped in (select ...) so they run once per statement (auth_rls_initplan).

alter table conference_booking_requests enable row level security;
alter table journey_requests enable row level security;

create policy conference_booking_requests_select_admin on conference_booking_requests for select to authenticated
  using ((select private.is_internal_portal_admin((select private.current_employee_id()))));

create policy journey_requests_select_admin on journey_requests for select to authenticated
  using ((select private.is_internal_portal_admin((select private.current_employee_id()))));
