-- Journeys module, file 3/6. The authorization primitive every RLS policy in this module
-- (and every Edge Function, via supabase/functions/_shared/authz.ts) checks against, plus
-- the transactional multi-table write functions for journey creation/editing.

-- Single authorization primitive for the whole Internal Portal: an employee with a
-- department_access_grants row scoped to the 'admin' department at access_level 'admin'.
-- Not routed through employee_has_permission/roles/role_permissions — that catalog has
-- zero seeded roles (per db/MIGRATIONS.md), so building on it would make this feature
-- non-functional out of the box. department_access_grants is already real and seeded.
create function private.is_internal_portal_admin(emp_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from department_access_grants dag
    join departments d on d.id = dag.department_id
    where dag.employee_id = emp_id
      and d.code = 'admin'
      and dag.access_level = 'admin'
  );
$$;

-- Transactional multi-table write for journey creation. security definer + EXECUTE
-- revoked from anon/authenticated, granted only to service_role — callable ONLY from the
-- create-journey Edge Function's service-role client via .rpc('create_journey', {...}),
-- never directly by any app.
--
-- payload shape:
-- {
--   vehicleId, driverId, createdBy, notes,
--   guests: [{ guestId?, fullName?, phone }],
--   stops: [{ sequenceNo, role, locationName, arrivalAt, pickups: [phone], drops: [phone] }]
-- }
create function public.create_journey(payload jsonb)
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
  v_journey_guest_id uuid;
  v_stop_id uuid;
  phone_map jsonb := '{}'::jsonb; -- phone -> journey_guest_id (text)
  ph text;
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
    phone_map := phone_map || jsonb_build_object(guest_rec->>'phone', v_journey_guest_id::text);
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

    for ph in select jsonb_array_elements_text(stop_rec->'pickups') loop
      insert into journey_stop_guests (stop_id, journey_guest_id, action)
      values (v_stop_id, (phone_map->>ph)::uuid, 'pickup');
    end loop;

    for ph in select jsonb_array_elements_text(stop_rec->'drops') loop
      insert into journey_stop_guests (stop_id, journey_guest_id, action)
      values (v_stop_id, (phone_map->>ph)::uuid, 'drop');
    end loop;
  end loop;

  return v_journey_id;
end;
$$;

-- Same contract, replaces an existing journey's guests/stops wholesale (delete + reinsert
-- — an edited route is complex to diff safely and this is a low-frequency admin action).
-- payload adds nothing beyond create_journey's shape; p_journey_id names the target.
create function public.update_journey(p_journey_id uuid, payload jsonb)
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
  v_journey_guest_id uuid;
  v_stop_id uuid;
  phone_map jsonb := '{}'::jsonb;
  ph text;
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
    phone_map := phone_map || jsonb_build_object(guest_rec->>'phone', v_journey_guest_id::text);
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

    for ph in select jsonb_array_elements_text(stop_rec->'pickups') loop
      insert into journey_stop_guests (stop_id, journey_guest_id, action)
      values (v_stop_id, (phone_map->>ph)::uuid, 'pickup');
    end loop;

    for ph in select jsonb_array_elements_text(stop_rec->'drops') loop
      insert into journey_stop_guests (stop_id, journey_guest_id, action)
      values (v_stop_id, (phone_map->>ph)::uuid, 'drop');
    end loop;
  end loop;
end;
$$;

revoke all on function public.create_journey(jsonb) from public;
grant execute on function public.create_journey(jsonb) to service_role;
revoke all on function public.update_journey(uuid, jsonb) from public;
grant execute on function public.update_journey(uuid, jsonb) to service_role;
