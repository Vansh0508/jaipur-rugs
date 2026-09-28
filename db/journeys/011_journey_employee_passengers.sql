-- Journeys module, file 11. Employees as journey passengers, alongside guests.
--
-- JOURNEY_GUESTS was guest-only (guest_id NOT NULL → guests). Employees can't just be
-- copied into `guests` by phone the way a returning guest is matched: 330 of 335 active
-- employees have no phone on file, and a copy would lose the link to the real employee
-- record. So a passenger row now references exactly ONE of guests or employees — the same
-- shape FEEDBACK already uses for its reviewer (feedback_reviewer_exactly_one,
-- db/feedback/006). journey_stop_guests is untouched: it points at journey_guests.id,
-- whichever kind of passenger that row is.

alter table journey_guests alter column guest_id drop not null;
alter table journey_guests add column employee_id uuid references employees(id);
alter table journey_guests add constraint journey_guests_passenger_exactly_one
  check (num_nonnulls(guest_id, employee_id) = 1);
alter table journey_guests add constraint journey_guests_journey_id_employee_id_key
  unique (journey_id, employee_id);
create index journey_guests_employee_id_idx on journey_guests(employee_id);

-- Internal Portal admins must be able to read the employee directory to pick employee
-- passengers, and to see their names on journeys planned by another admin (PostgREST
-- embeds run under the reader's RLS). employees_select only allowed self, manager chain,
-- same department, or employees.read.all. The one admin today already holds
-- employees.read.all, so this changes nothing now; it keeps the feature from silently
-- breaking for the next admin. Same single combined policy (multiple_permissive_policies
-- advisor), helpers wrapped in (select ...) where they take no row input.
drop policy employees_select on employees;
create policy employees_select on employees
  for select to authenticated
  using (
    auth_user_id = (select auth.uid())
    or private.fn_is_in_manager_chain(private.current_employee_id(), id)
    or private.fn_is_in_manager_chain(id, private.current_employee_id())
    or department_id = private.current_employee_department_id()
    or private.employee_has_permission(private.current_employee_id(), 'employees.read.all')
    or (select private.is_internal_portal_admin((select private.current_employee_id())))
  );

-- create_journey / update_journey: a `guests` entry is now EITHER
--   { employeeId, key? }                       — an existing, active employee, or
--   { guestId?, fullName?, phone, key? }       — a guest, matched-or-created by phone (as before).
-- Stops' pickups/drops reference passengers by `key`, which defaults to `phone` — so every
-- existing caller (phone-keyed) keeps working unchanged. Employee entries must send a key
-- (Internal Portal uses "employee:<id>"), since most employees have no phone.
create or replace function public.create_journey(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_journey_id uuid;
  v_first_pickup timestamptz;
  v_last_drop timestamptz;
  v_conflict_id uuid;
  v_conflict_from date;
  v_conflict_to date;
  v_conflict_resource text;
  guest_rec jsonb;
  stop_rec jsonb;
  v_guest_id uuid;
  v_employee_id uuid;
  v_journey_guest_id uuid;
  v_stop_id uuid;
  key_map jsonb := '{}'::jsonb; -- passenger key -> journey_guest_id (text)
  v_key text;
begin
  select min((s->>'arrivalAt')::timestamptz) into v_first_pickup
    from jsonb_array_elements(payload->'stops') s
    where jsonb_array_length(s->'pickups') > 0;
  select max((s->>'arrivalAt')::timestamptz) into v_last_drop
    from jsonb_array_elements(payload->'stops') s
    where jsonb_array_length(s->'drops') > 0;

  if v_first_pickup is null or v_last_drop is null then
    raise exception 'journey must have at least one pickup and one drop';
  end if;

  begin
    insert into journeys (vehicle_id, driver_id, created_by, notes, first_pickup_at, last_drop_at, date_from, date_to)
    values (
      (payload->>'vehicleId')::uuid,
      (payload->>'driverId')::uuid,
      (payload->>'createdBy')::uuid,
      payload->>'notes',
      v_first_pickup,
      v_last_drop,
      v_first_pickup::date,
      v_last_drop::date
    )
    returning id into v_journey_id;
  exception when exclusion_violation then
    select j.id, j.date_from, j.date_to,
      case when j.vehicle_id = (payload->>'vehicleId')::uuid then 'vehicle' else 'driver' end
    into v_conflict_id, v_conflict_from, v_conflict_to, v_conflict_resource
    from journeys j
    where j.status <> 'cancelled'
      and j.busy_window && tstzrange(v_first_pickup, v_last_drop, '[]')
      and (j.vehicle_id = (payload->>'vehicleId')::uuid or j.driver_id = (payload->>'driverId')::uuid)
    limit 1;
    raise exception 'journey_conflict:%:%:%:%', v_conflict_resource, v_conflict_id, v_conflict_from, v_conflict_to;
  end;

  for guest_rec in select value from jsonb_array_elements(payload->'guests') loop
    v_key := coalesce(guest_rec->>'key', guest_rec->>'phone');
    if guest_rec->>'employeeId' is not null then
      select id into v_employee_id from employees
        where id = (guest_rec->>'employeeId')::uuid and status = 'active';
      if v_employee_id is null then
        raise exception 'employee % not found or not active', guest_rec->>'employeeId';
      end if;
      insert into journey_guests (journey_id, employee_id) values (v_journey_id, v_employee_id)
        returning id into v_journey_guest_id;
    else
      if guest_rec ? 'guestId' and guest_rec->>'guestId' is not null then
        v_guest_id := (guest_rec->>'guestId')::uuid;
        if guest_rec->>'fullName' is not null then
          update guests set full_name = guest_rec->>'fullName', updated_at = now() where id = v_guest_id;
        end if;
      else
        select id into v_guest_id from guests where phone = guest_rec->>'phone';
        if v_guest_id is null then
          insert into guests (full_name, phone)
          values (coalesce(guest_rec->>'fullName', guest_rec->>'phone'), guest_rec->>'phone')
          returning id into v_guest_id;
        elsif guest_rec->>'fullName' is not null then
          update guests set full_name = guest_rec->>'fullName', updated_at = now() where id = v_guest_id;
        end if;
      end if;
      insert into journey_guests (journey_id, guest_id) values (v_journey_id, v_guest_id)
        returning id into v_journey_guest_id;
    end if;
    key_map := key_map || jsonb_build_object(v_key, v_journey_guest_id::text);
  end loop;

  for stop_rec in select value from jsonb_array_elements(payload->'stops') order by (value->>'sequenceNo')::int loop
    insert into journey_stops (journey_id, sequence_no, role, location_name, arrival_at)
    values (
      v_journey_id,
      (stop_rec->>'sequenceNo')::int,
      (stop_rec->>'role')::stop_role,
      stop_rec->>'locationName',
      (stop_rec->>'arrivalAt')::timestamptz
    )
    returning id into v_stop_id;

    for v_key in select jsonb_array_elements_text(stop_rec->'pickups') loop
      insert into journey_stop_guests (stop_id, journey_guest_id, action)
      values (v_stop_id, (key_map->>v_key)::uuid, 'pickup');
    end loop;

    for v_key in select jsonb_array_elements_text(stop_rec->'drops') loop
      insert into journey_stop_guests (stop_id, journey_guest_id, action)
      values (v_stop_id, (key_map->>v_key)::uuid, 'drop');
    end loop;
  end loop;

  return v_journey_id;
end;
$$;

create or replace function public.update_journey(p_journey_id uuid, payload jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_first_pickup timestamptz;
  v_last_drop timestamptz;
  v_conflict_id uuid;
  v_conflict_from date;
  v_conflict_to date;
  v_conflict_resource text;
  guest_rec jsonb;
  stop_rec jsonb;
  v_guest_id uuid;
  v_employee_id uuid;
  v_journey_guest_id uuid;
  v_stop_id uuid;
  key_map jsonb := '{}'::jsonb;
  v_key text;
begin
  select min((s->>'arrivalAt')::timestamptz) into v_first_pickup
    from jsonb_array_elements(payload->'stops') s
    where jsonb_array_length(s->'pickups') > 0;
  select max((s->>'arrivalAt')::timestamptz) into v_last_drop
    from jsonb_array_elements(payload->'stops') s
    where jsonb_array_length(s->'drops') > 0;

  if v_first_pickup is null or v_last_drop is null then
    raise exception 'journey must have at least one pickup and one drop';
  end if;

  delete from journey_stop_guests where stop_id in (select id from journey_stops where journey_id = p_journey_id);
  delete from journey_stops where journey_id = p_journey_id;
  delete from journey_guests where journey_id = p_journey_id;

  begin
    update journeys
    set vehicle_id = (payload->>'vehicleId')::uuid,
        driver_id = (payload->>'driverId')::uuid,
        notes = payload->>'notes',
        first_pickup_at = v_first_pickup,
        last_drop_at = v_last_drop,
        date_from = v_first_pickup::date,
        date_to = v_last_drop::date,
        updated_at = now()
    where id = p_journey_id;
  exception when exclusion_violation then
    select j.id, j.date_from, j.date_to,
      case when j.vehicle_id = (payload->>'vehicleId')::uuid then 'vehicle' else 'driver' end
    into v_conflict_id, v_conflict_from, v_conflict_to, v_conflict_resource
    from journeys j
    where j.status <> 'cancelled'
      and j.id <> p_journey_id
      and j.busy_window && tstzrange(v_first_pickup, v_last_drop, '[]')
      and (j.vehicle_id = (payload->>'vehicleId')::uuid or j.driver_id = (payload->>'driverId')::uuid)
    limit 1;
    raise exception 'journey_conflict:%:%:%:%', v_conflict_resource, v_conflict_id, v_conflict_from, v_conflict_to;
  end;

  for guest_rec in select value from jsonb_array_elements(payload->'guests') loop
    v_key := coalesce(guest_rec->>'key', guest_rec->>'phone');
    if guest_rec->>'employeeId' is not null then
      select id into v_employee_id from employees
        where id = (guest_rec->>'employeeId')::uuid and status = 'active';
      if v_employee_id is null then
        raise exception 'employee % not found or not active', guest_rec->>'employeeId';
      end if;
      insert into journey_guests (journey_id, employee_id) values (p_journey_id, v_employee_id)
        returning id into v_journey_guest_id;
    else
      if guest_rec ? 'guestId' and guest_rec->>'guestId' is not null then
        v_guest_id := (guest_rec->>'guestId')::uuid;
        if guest_rec->>'fullName' is not null then
          update guests set full_name = guest_rec->>'fullName', updated_at = now() where id = v_guest_id;
        end if;
      else
        select id into v_guest_id from guests where phone = guest_rec->>'phone';
        if v_guest_id is null then
          insert into guests (full_name, phone)
          values (coalesce(guest_rec->>'fullName', guest_rec->>'phone'), guest_rec->>'phone')
          returning id into v_guest_id;
        elsif guest_rec->>'fullName' is not null then
          update guests set full_name = guest_rec->>'fullName', updated_at = now() where id = v_guest_id;
        end if;
      end if;
      insert into journey_guests (journey_id, guest_id) values (p_journey_id, v_guest_id)
        returning id into v_journey_guest_id;
    end if;
    key_map := key_map || jsonb_build_object(v_key, v_journey_guest_id::text);
  end loop;

  for stop_rec in select value from jsonb_array_elements(payload->'stops') order by (value->>'sequenceNo')::int loop
    insert into journey_stops (journey_id, sequence_no, role, location_name, arrival_at)
    values (
      p_journey_id,
      (stop_rec->>'sequenceNo')::int,
      (stop_rec->>'role')::stop_role,
      stop_rec->>'locationName',
      (stop_rec->>'arrivalAt')::timestamptz
    )
    returning id into v_stop_id;

    for v_key in select jsonb_array_elements_text(stop_rec->'pickups') loop
      insert into journey_stop_guests (stop_id, journey_guest_id, action)
      values (v_stop_id, (key_map->>v_key)::uuid, 'pickup');
    end loop;

    for v_key in select jsonb_array_elements_text(stop_rec->'drops') loop
      insert into journey_stop_guests (stop_id, journey_guest_id, action)
      values (v_stop_id, (key_map->>v_key)::uuid, 'drop');
    end loop;
  end loop;
end;
$$;

-- `create or replace` keeps the existing EXECUTE grants (service_role only, see 003/006) —
-- restated so this file is correct on its own.
revoke all on function public.create_journey(jsonb) from public, anon, authenticated;
grant execute on function public.create_journey(jsonb) to service_role;
revoke all on function public.update_journey(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.update_journey(uuid, jsonb) to service_role;
