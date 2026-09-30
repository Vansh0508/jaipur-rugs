-- Booking-requests module, file 1/3. CONFERENCE_BOOKING_REQUESTS and JOURNEY_REQUESTS —
-- what an employee asks for from the employee portal, waiting on an Internal Portal admin.
-- See booking-requests-schema.mmd for the ERD and the reasoning.
--
-- Depends on: employees (db/team-members/001), conference_rooms / conference_bookings
-- (db/conference/001), journeys (db/journeys/002), private.is_internal_portal_admin (002).

create type booking_request_status as enum ('pending', 'approved', 'rejected');

create table conference_booking_requests (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references conference_rooms(id),
  requested_by uuid not null references employees(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  seating_count integer not null check (seating_count > 0),
  event_name text not null check (length(btrim(event_name)) between 1 and 200),
  event_details text check (event_details is null or length(event_details) <= 2000),
  status booking_request_status not null default 'pending',
  decided_by uuid references employees(id),
  decided_at timestamptz,
  decision_note text check (decision_note is null or length(decision_note) <= 1000),
  booking_id uuid unique references conference_bookings(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  constraint conference_booking_requests_decision_consistent check (
    (status = 'pending' and decided_by is null and decided_at is null and booking_id is null)
    or (status = 'approved' and decided_by is not null and decided_at is not null and booking_id is not null)
    or (status = 'rejected' and decided_by is not null and decided_at is not null and booking_id is null)
  )
);

create table journey_requests (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid not null references employees(id),
  -- create_journey's payload minus vehicleId / driverId / createdBy / notes: { guests, stops }.
  trip jsonb not null check (jsonb_typeof(trip -> 'guests') = 'array' and jsonb_typeof(trip -> 'stops') = 'array'),
  first_pickup_at timestamptz not null,
  last_drop_at timestamptz not null,
  route_summary text not null,
  passenger_count integer not null check (passenger_count > 0),
  notes text check (notes is null or length(notes) <= 2000),
  status booking_request_status not null default 'pending',
  decided_by uuid references employees(id),
  decided_at timestamptz,
  decision_note text check (decision_note is null or length(decision_note) <= 1000),
  journey_id uuid unique references journeys(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (last_drop_at > first_pickup_at),
  constraint journey_requests_decision_consistent check (
    (status = 'pending' and decided_by is null and decided_at is null and journey_id is null)
    or (status = 'approved' and decided_by is not null and decided_at is not null and journey_id is not null)
    or (status = 'rejected' and decided_by is not null and decided_at is not null and journey_id is null)
  )
);

-- Every FK gets an index (unindexed_foreign_keys advisor; booking_id / journey_id are covered
-- by their unique constraints). The partial indexes back the admin's "pending" lists, which
-- sort by when the requested slot starts.
create index conference_booking_requests_room_id_idx on conference_booking_requests (room_id);
create index conference_booking_requests_requested_by_idx on conference_booking_requests (requested_by);
create index conference_booking_requests_decided_by_idx on conference_booking_requests (decided_by);
create index conference_booking_requests_pending_idx on conference_booking_requests (starts_at) where status = 'pending';

create index journey_requests_requested_by_idx on journey_requests (requested_by);
create index journey_requests_decided_by_idx on journey_requests (decided_by);
create index journey_requests_pending_idx on journey_requests (first_pickup_at) where status = 'pending';
