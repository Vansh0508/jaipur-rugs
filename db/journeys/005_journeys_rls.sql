-- Journeys module, file 5/6. Admin-only reads on every new table, plus `guests` (which
-- had NO select policy for any client role before this — internal-portal's "pick existing
-- guest" dropdown is the first thing that needs to read it). Deliberately no
-- INSERT/UPDATE/DELETE policy anywhere here, and no change to vehicles/drivers' existing
-- write posture — every write in this module goes through create_journey/update_journey
-- or a service-role Edge Function only (see 003, and supabase/functions/*).

alter table journeys enable row level security;
alter table journey_guests enable row level security;
alter table journey_stops enable row level security;
alter table journey_stop_guests enable row level security;

create policy journeys_select_admin on journeys for select to authenticated
  using (private.is_internal_portal_admin(private.current_employee_id()));

create policy journey_guests_select_admin on journey_guests for select to authenticated
  using (private.is_internal_portal_admin(private.current_employee_id()));

create policy journey_stops_select_admin on journey_stops for select to authenticated
  using (private.is_internal_portal_admin(private.current_employee_id()));

create policy journey_stop_guests_select_admin on journey_stop_guests for select to authenticated
  using (private.is_internal_portal_admin(private.current_employee_id()));

create policy guests_select_admin on guests for select to authenticated
  using (private.is_internal_portal_admin(private.current_employee_id()));
