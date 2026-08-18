-- Journeys module, file 2/6. Core new tables: JOURNEYS, JOURNEY_GUESTS, JOURNEY_STOPS,
-- JOURNEY_STOP_GUESTS. See journeys-schema.mmd for the ERD and full reasoning.

create extension if not exists btree_gist;

create type journey_status as enum ('planned', 'ongoing', 'completed', 'cancelled');
create type stop_role as enum ('origin', 'stop', 'destination');
create type stop_guest_action as enum ('pickup', 'drop');

-- vehicle_id/driver_id are mandatory: the whole point of this table is "block a car+driver
-- for a route", and the exclude constraints below only make sense once both are known.
--
-- date_from/date_to are GENERATED from first_pickup_at/last_drop_at, not independent
-- inputs — the "top-level trip date range" shown in the UI is just the date portion of
-- the precise conflict-checking window; storing them independently would let them drift.
create table journeys (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles(id),
  driver_id uuid not null references drivers(id),
  status journey_status not null default 'planned',
  first_pickup_at timestamptz not null,  -- min(arrival_at) over stops with a pickup
  last_drop_at timestamptz not null,     -- max(arrival_at) over stops with a drop
  busy_window tstzrange generated always as (tstzrange(first_pickup_at, last_drop_at, '[]')) stored,
  -- NOT generated columns: casting timestamptz -> date depends on the TimeZone GUC, which
  -- Postgres treats as STABLE, not IMMUTABLE — disallowed in a generated expression.
  -- Kept in sync via the trigger below instead (runtime execution has no such
  -- restriction).
  date_from date not null,
  date_to date not null,
  notes text,
  created_by uuid not null references employees(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (last_drop_at >= first_pickup_at)
);

create function private.set_journey_date_range()
returns trigger
language plpgsql
as $$
begin
  new.date_from := (new.first_pickup_at)::date;
  new.date_to := (new.last_drop_at)::date;
  return new;
end;
$$;

create trigger trg_set_journey_date_range
before insert or update on journeys
for each row execute function private.set_journey_date_range();

-- THE car-conflict / no-double-booking mechanism. `where status <> 'cancelled'` matches
-- "excluding cancelled journeys" exactly; overlap semantics (&&) on the range naturally
-- give "ends before the next one starts => no conflict", with no special-casing.
alter table journeys add constraint journeys_vehicle_no_overlap
  exclude using gist (vehicle_id with =, busy_window with &&)
  where (status <> 'cancelled');

alter table journeys add constraint journeys_driver_no_overlap
  exclude using gist (driver_id with =, busy_window with &&)
  where (status <> 'cancelled');

create index journeys_vehicle_id_date_from_idx on journeys(vehicle_id, date_from desc);
create index journeys_driver_id_date_from_idx on journeys(driver_id, date_from desc);
create index journeys_status_idx on journeys(status);
create index journeys_created_by_idx on journeys(created_by);

-- JOURNEY_GUESTS: who's on the journey overall. Reuses db/feedback's `guests` table
-- (phone stays the natural lookup/dedupe key — already unique, no schema change needed).
create table journey_guests (
  id uuid primary key default gen_random_uuid(),
  journey_id uuid not null references journeys(id) on delete cascade,
  guest_id uuid not null references guests(id),
  created_at timestamptz not null default now(),
  unique (journey_id, guest_id)
);

create index journey_guests_journey_id_idx on journey_guests(journey_id);
create index journey_guests_guest_id_idx on journey_guests(guest_id);

-- JOURNEY_STOPS: ordered route. Exactly one 'origin' (pickups only) and one 'destination'
-- (drops only) per journey, enforced via partial unique indexes. Ordering/contiguity of
-- intermediate stops is validated in create_journey/update_journey (a whole-set
-- invariant a single-row CHECK can't express).
create table journey_stops (
  id uuid primary key default gen_random_uuid(),
  journey_id uuid not null references journeys(id) on delete cascade,
  sequence_no int not null check (sequence_no >= 0),
  role stop_role not null,
  location_name text not null,
  arrival_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (journey_id, sequence_no)
);

create index journey_stops_journey_id_idx on journey_stops(journey_id);
create unique index journey_stops_one_origin_per_journey on journey_stops(journey_id) where role = 'origin';
create unique index journey_stops_one_destination_per_journey on journey_stops(journey_id) where role = 'destination';

-- JOURNEY_STOP_GUESTS: which guests are picked up/dropped at which stop. References
-- journey_guests (not guests directly) — scopes the action to this journey's guest-list
-- entry, avoiding ambiguity if a guest ever appears on more than one journey.
create table journey_stop_guests (
  id uuid primary key default gen_random_uuid(),
  stop_id uuid not null references journey_stops(id) on delete cascade,
  journey_guest_id uuid not null references journey_guests(id) on delete cascade,
  action stop_guest_action not null,
  created_at timestamptz not null default now(),
  unique (stop_id, journey_guest_id, action)
);

create index journey_stop_guests_stop_id_idx on journey_stop_guests(stop_id);
create index journey_stop_guests_journey_guest_id_idx on journey_stop_guests(journey_guest_id);

-- Origin=pickup-only / destination=drop-only invariant. Defense-in-depth (primary
-- enforcement is in create_journey/update_journey, since those are the sole write path —
-- no client INSERT policy exists on this table at all).
create function private.validate_stop_guest_action()
returns trigger
language plpgsql
as $$
declare
  v_role stop_role;
begin
  select role into v_role from journey_stops where id = new.stop_id;
  if v_role = 'origin' and new.action = 'drop' then
    raise exception 'origin stop cannot have a drop action';
  end if;
  if v_role = 'destination' and new.action = 'pickup' then
    raise exception 'destination stop cannot have a pickup action';
  end if;
  return new;
end;
$$;

create trigger trg_validate_stop_guest_action
before insert or update on journey_stop_guests
for each row execute function private.validate_stop_guest_action();
