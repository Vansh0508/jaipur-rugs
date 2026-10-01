-- Booking-requests module, file 4. A conference room can't be booked for time that has
-- already started — the rule the Edge Functions (supabase/functions/_shared/conference.ts
-- startHasPassed) and both apps' forms now apply. Approving a request used to be allowed until
-- its END had passed, which would book a meeting that was already under way; now it's refused
-- once the START has passed (with the same 5-minute grace as the Edge Functions), and the
-- request can only be rejected.
--
-- Only that one check changes; the rest of decide_conference_request is as in 003.
-- CREATE OR REPLACE keeps the function's grants, but they're re-stated so this file alone
-- says who can call it.

create or replace function public.decide_conference_request(
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
    if r.starts_at < now() - interval '5 minutes' then
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

revoke execute on function public.decide_conference_request(uuid, uuid, booking_request_status, text) from public, anon, authenticated;
grant execute on function public.decide_conference_request(uuid, uuid, booking_request_status, text) to service_role;
