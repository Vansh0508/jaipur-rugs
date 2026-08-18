-- Journeys module, file 1/6. Alters feedback-owned tables (vehicles, drivers) because the
-- changes are entirely driven by this feature (car status/QR identity, driver phone
-- format/code sequence). This lives in db/journeys, not db/feedback, because it's
-- structurally entangled with the new tables in 002 (the EXCLUDE constraints there
-- reference vehicles/drivers directly) — must run AFTER db/feedback/001..005 and
-- db/team-members/001..004.
--
-- No new "cars" table: `vehicles` already has make/model/fuel_type/registration_number,
-- which is what the "Cars" feature is built on — just three added columns.

create type vehicle_status as enum ('vacant', 'on_trip', 'maintenance');

alter table vehicles add column name text;
update vehicles set name = make || ' ' || model where name is null; -- backfill the 14 seeded rows
alter table vehicles alter column name set not null;

alter table vehicles add column status vehicle_status not null default 'vacant';

-- QR: vehicles.id is already a random UUID — reuse it as the future QR endpoint's key
-- (e.g. /qr/vehicles/:id) rather than inventing a redundant slug column. This column only
-- caches the *rendered* QR image URL once that endpoint exists; nullable until then.
alter table vehicles add column qr_code_url text;

create index vehicles_status_idx on vehicles(status);

-- Driver phone is already E.164 with country code in the seed data ("+91..."), so no
-- column change — just make it mandatory and format-validated (mirrors the E.164 check
-- already enforced in supabase/functions/guest-signup/index.ts).
alter table drivers alter column phone set not null;
alter table drivers add constraint drivers_phone_e164
  check (phone ~ '^\+[1-9]\d{6,14}$');

-- Sequential driver_code generation for create-driver (DB-atomic, race-free — avoids a
-- "read MAX(driver_code), +1" race between two concurrent creates). Existing seed used
-- DRV-001..DRV-013, so start the sequence at 14.
create sequence driver_code_seq start with 14;
