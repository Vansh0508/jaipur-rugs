-- Booking-requests module, file 3/3. Approving / rejecting a request, as one transaction.
--
-- Approving has to do two writes — create the real booking (or journey) and mark the request
-- approved with a link to it — and they must land together or not at all, which two separate
-- PostgREST calls from an Edge Function can't promise. So, like create_journey
-- (db/journeys/003), these are security definer functions with EXECUTE revoked from
-- everyone but service_role: only conference-request-decide / journey-request-decide (which
-- first check the caller is an Internal Portal admin) can call them, via .rpc().
--
-- The request row is locked (FOR UPDATE) and must still be pending, so two admins deciding
-- at once can't both approve it. Failures are raised as `request_<reason>` messages the Edge
-- Functions turn into plain words; a double-booking surfaces as the usual exclusion_violation
-- (conference) or `journey_conflict:...` (create_journey), exactly as for an admin booking.

create function public.decide_conference_request(
  p_request_id uuid,
  p_admin_id uuid,
  p_decision booking_request_status,
  p_note text default null
)
returns uuid -- the new conference_bookings.id when approved, null when rejected
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r conference_booking_requests%rowtype;
  v_room_status conference_room_status;
  v_room_capacity integer;
  v_booking_id uuid;
begin
  if p_decision = 'pending' then
    raise exception 'request_decision_invalid';
  end if;

  select * into r from conference_booking_requests where id = p_request_id for update;
  if not found then
    raise exception 'request_not_found';
  end if;
  if r.status <> 'pending' then
    raise exception 'request_already_decided:%', r.status;
  end if;

  if p_decision = 'approved' then
    if r.ends_at <= now() then
      raise exception 'request_time_passed';
    end if;
    if not exists (select 1 from employees where id = r.requested_by and status = 'active') then
      raise exception 'request_employee_inactive';
    end if;
    select status, capacity into v_room_status, v_room_capacity from conference_rooms where id = r.room_id;
    if v_room_status is distinct from 'active' then
      raise exception 'request_room_removed';
    end if;
    if v_room_capacity is not null and r.seating_count > v_room_capacity then
      raise exception 'request_over_capacity:%', v_room_capacity;
    end if;

    -- conference_bookings_room_no_overlap raises exclusion_violation (23P01) on a clash.
    insert into conference_bookings (room_id, employee_id, starts_at, ends_at, seating_count, event_name, event_details, created_by)
    values (r.room_id, r.requested_by, r.starts_at, r.ends_at, r.seating_count, r.event_name, r.event_details, p_admin_id)
    returning id into v_booking_id;
  end if;

  update conference_booking_requests
  set status = p_decision,
      decided_by = p_admin_id,
      decided_at = now(),
      decision_note = nullif(btrim(p_note), ''),
      booking_id = v_booking_id,
      updated_at = now()
  where id = p_request_id;

  return v_booking_id;
end;
$$;

create function public.decide_journey_request(
  p_request_id uuid,
  p_admin_id uuid,
  p_decision booking_request_status,
  p_note text default null,
  p_vehicle_id uuid default null,
  p_driver_id uuid default null
)
returns uuid -- the new journeys.id when approved, null when rejected
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r journey_requests%rowtype;
  v_journey_id uuid;
begin
  if p_decision = 'pending' then
    raise exception 'request_decision_invalid';
  end if;

  select * into r from journey_requests where id = p_request_id for update;
  if not found then
    raise exception 'request_not_found';
  end if;
  if r.status <> 'pending' then
    raise exception 'request_already_decided:%', r.status;
  end if;

  if p_decision = 'approved' then
    if p_vehicle_id is null or p_driver_id is null then
      raise exception 'request_assignment_required';
    end if;
    if r.last_drop_at <= now() then
      raise exception 'request_time_passed';
    end if;
    -- create_journey owns every journey rule (car/driver double-booking, active employee
    -- passengers, guest match-or-create by phone); its errors propagate unchanged.
    v_journey_id := public.create_journey(
      r.trip || jsonb_build_object(
        'vehicleId', p_vehicle_id,
        'driverId', p_driver_id,
        'createdBy', p_admin_id,
        'notes', r.notes
      )
    );
  end if;

  update journey_requests
  set status = p_decision,
      decided_by = p_admin_id,
      decided_at = now(),
      decision_note = nullif(btrim(p_note), ''),
      journey_id = v_journey_id,
      updated_at = now()
  where id = p_request_id;

  return v_journey_id;
end;
$$;

-- Supabase's default privileges grant EXECUTE on new public functions to anon and
-- authenticated as well as PUBLIC, so all three are revoked explicitly (db/team-members/007
-- had to fix exactly this after the fact).
revoke execute on function public.decide_conference_request(uuid, uuid, booking_request_status, text) from public, anon, authenticated;
grant execute on function public.decide_conference_request(uuid, uuid, booking_request_status, text) to service_role;

revoke execute on function public.decide_journey_request(uuid, uuid, booking_request_status, text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.decide_journey_request(uuid, uuid, booking_request_status, text, uuid, uuid) to service_role;
