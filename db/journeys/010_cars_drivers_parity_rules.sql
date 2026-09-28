-- Journeys module, file 10. Cars/drivers parity, part 2 (see 009 for the enum values).
-- Row-level rules the upcoming edit/status/soft-delete Edge Functions rely on, enforced in
-- the DB so every write path gets them, not just one function.

-- 1. Internal Portal admins must see drivers in EVERY status. drivers_select_active
-- (db/feedback/001) only ever returned status = 'active' to authenticated users, so a
-- driver set inactive/on_leave/suspended vanished from the admin portal too, with no way
-- to see or reactivate them. One combined policy, not a second permissive one
-- (multiple_permissive_policies — see db/feedback/002_advisor_fixes.sql). Helper calls are
-- wrapped in (select ...) so they're evaluated once per query, not once per row.
-- drivers_select_active_anon (guests, no session) is deliberately left as-is: active only.
drop policy if exists drivers_select_active on drivers;
create policy drivers_select on drivers
  for select to authenticated
  using (
    status = 'active'
    or (select private.is_internal_portal_admin((select private.current_employee_id())))
  );

-- 2. Number plates are stored trimmed + uppercase whatever the caller sends, matching
-- driver-app-new's createCar/updateCar normalization. Without this, "rj14-uh-8196" would
-- slip past vehicles_registration_number_key as a "different" plate. All 14 existing rows
-- were already normalized (checked live before this migration), so no backfill needed.
create function private.normalize_vehicle_registration_number()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.registration_number := upper(btrim(new.registration_number));
  return new;
end;
$$;

create trigger trg_normalize_vehicle_registration_number
before insert or update of registration_number on vehicles
for each row execute function private.normalize_vehicle_registration_number();

-- 3. Keep updated_at truthful now that rows get edited (edit car/driver, status changes).
-- Neither table had an updated_at trigger. New helper in `private`, not the orphaned
-- public.set_updated_at already on this project (attached to no table, pre-existing debris)
-- — AGENTS.md Section 10: internal helpers belong in `private`, never in exposed `public`.
create function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_vehicles_touch_updated_at
before update on vehicles
for each row execute function private.touch_updated_at();

create trigger trg_drivers_touch_updated_at
before update on drivers
for each row execute function private.touch_updated_at();
