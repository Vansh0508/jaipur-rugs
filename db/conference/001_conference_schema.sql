-- Conference module, file 1/2. CONFERENCE_ROOMS and CONFERENCE_BOOKINGS. See
-- conference-schema.mmd for the ERD and the reasoning.
--
-- Depends on: employees (db/team-members/001), private.is_internal_portal_admin (used by 002).
-- The GiST operator classes for uuid `=` come from btree_gist, which db/journeys/006
-- relocated from `public` to `extensions` — the search_path below makes sure this
-- migration resolves them there, whichever role runs it.

set local search_path = public, extensions, pg_temp;

create extension if not exists btree_gist;

create type conference_room_status as enum ('active', 'inactive');
create type conference_booking_status as enum ('confirmed', 'cancelled');

create table conference_rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  -- Optional seating limit. NULL = unlimited / not recorded. When set,
  -- conference-booking-create rejects a sitting arrangement above it.
  capacity integer check (capacity is null or capacity > 0),
  -- "Removing" a room is a soft-delete: bookings keep a foreign key to it (calendar history).
  status conference_room_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Case-insensitive unique name ("Board Room" and "board room" are the same venue). A
-- removed room keeps its name reserved; restoring it is the way back.
create unique index conference_rooms_name_key on conference_rooms (lower(btrim(name)));

create table conference_bookings (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references conference_rooms(id),
  employee_id uuid not null references employees(id),   -- who the booking is for
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  -- Half-open: back-to-back bookings (one ends 11:00, next starts 11:00) do not conflict.
  during tstzrange generated always as (tstzrange(starts_at, ends_at, '[)')) stored,
  seating_count integer not null check (seating_count > 0),
  event_name text not null check (length(btrim(event_name)) > 0),
  event_details text,
  status conference_booking_status not null default 'confirmed',
  created_by uuid not null references employees(id),    -- the admin who entered it
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

-- THE no-double-booking guarantee. Cancelled bookings don't block the slot.
alter table conference_bookings add constraint conference_bookings_room_no_overlap
  exclude using gist (room_id with =, during with &&)
  where (status = 'confirmed');

-- Every FK gets an index (the unindexed_foreign_keys advisor), and starts_at backs the
-- calendar's date-range reads.
create index conference_bookings_room_id_starts_at_idx on conference_bookings (room_id, starts_at);
create index conference_bookings_starts_at_idx on conference_bookings (starts_at);
create index conference_bookings_employee_id_idx on conference_bookings (employee_id);
create index conference_bookings_created_by_idx on conference_bookings (created_by);
