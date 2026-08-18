-- Driver roster + vehicle fleet, per the Admin Team's provided lists (applied 2026-08-18).

-- Vehicles: independent fleet roster, no established driver assignment (the two lists
-- don't provide a mapping, and counts don't match 1:1 — 13 drivers vs 14 vehicles) — add
-- a driver_id FK later if/when an actual assignment is provided.
create type fuel_type as enum ('diesel', 'ev', 'petrol');

create table vehicles (
  id uuid primary key default gen_random_uuid(),
  registration_number text unique not null,
  make text not null,
  model text not null,
  fuel_type fuel_type not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table vehicles enable row level security;

-- No anon grant — nothing guest-facing consumes vehicle data (unlike drivers, which the
-- guest-facing grid explicitly needs). Add if/when that changes.
create policy vehicles_select_all on vehicles for select to authenticated using (true);

-- Driver phone numbers are personal data — `drivers` is anon-readable (guests need the
-- name/photo grid with no session at all), but blanket table access would let anyone
-- holding the public anon key query phone numbers directly via the REST API. Restrict
-- the anon role to only the columns the guest-facing UI actually needs.
revoke select on drivers from anon;
grant select (id, driver_code, full_name, photo_path, status, created_at, updated_at) on drivers to anon;

-- Seed data ---------------------------------------------------------------

insert into drivers (driver_code, full_name, phone, status) values
  ('DRV-001', 'Amit Yadav', '+918800607167', 'active'),
  ('DRV-002', 'Sanjay Kumar Chandoliya', '+918107064932', 'active'),
  ('DRV-003', 'Devi Lal Saini', '+917665435210', 'active'),
  ('DRV-004', 'Kapil Meena', '+919799933876', 'active'),
  ('DRV-005', 'Hazari Lal Meena', '+918107547801', 'active'),
  ('DRV-006', 'Omprakash Raigar', '+919461411522', 'active'),
  ('DRV-007', 'Suresh Kumar Sharma', '+919929796917', 'active'),
  ('DRV-008', 'Swatantra Prasad Solanki', '+919829547268', 'active'),
  ('DRV-009', 'Omprakash Saini', '+918690382523', 'active'),
  ('DRV-010', 'Mahendra Singh Gurjar', '+918741097712', 'active'),
  ('DRV-011', 'Shiv Kumar', '+918852083048', 'active'),
  ('DRV-012', 'Gorishanakar Meena', '+916350574022', 'active'),
  ('DRV-013', 'Shubham', '+919079959879', 'active');

insert into vehicles (registration_number, make, model, fuel_type) values
  ('RJ14-UG-6552', 'Audi', 'Audi Q7-45 TDI', 'diesel'),
  ('RJ14-UH-8196', 'Mahindra & Mahindra', 'Bolero Neo', 'diesel'),
  ('RJ14-CU-1368', 'Tata', 'Nexon EV Max XZ+', 'ev'),
  ('RJ45-CF-2759', 'Maruti Suzuki India Ltd.', 'Ciaz Smart Hybrid AT Alpha', 'petrol'),
  ('RJ45-CW-7270', 'Mahindra', 'XUV400 EL', 'ev'),
  ('RJ45-CT-2827', 'Tata Motors', 'Nexon EV', 'ev'),
  ('RJ14-UH-1076', 'Mahindra', 'Bolero B6 (O) BS-VI', 'diesel'),
  ('RJ14-UF-6224', 'Toyota', 'Innova Crysta 2.4 VX MT BS-IV 8 STR', 'diesel'),
  ('RJ45-CY-2661', 'BYD', 'BYD E6', 'ev'),
  ('RJ14-FA-0701', 'Mahindra', 'Bolero B6 (O) BS-VI', 'diesel'),
  ('RJ60-CA-7293', 'Maruti Suzuki', 'Baleno', 'petrol'),
  ('RJ14-UQ-1666', 'Jeep', 'Meridian', 'diesel'),
  ('RJ14-GT-1907', 'Mahindra', 'Pickup', 'diesel'),
  ('RJ14-UL-4381', 'Toyota', 'Innova Hycross', 'petrol');
