-- Feedback module — DRIVERS, GUESTS, FEEDBACK (see feedback-schema.mmd for the ERD).
--
-- APPLIED 2026-08-17 to project matnispbauvvlnbsuzxq, immediately after
-- db/team-members/001_team_members_schema.sql (required — see SEQUENCING below).
-- See db/MIGRATIONS.md for the full applied-migration ledger and advisor-fix follow-up
-- (002_advisor_fixes.sql). This file is deliberately self-contained: it does not reference
-- the team-members module's RBAC helper functions (e.g. employee_has_permission) — those
-- live in a separate `private` schema and DRIVERS has no permission-gated write policy yet
-- (see the TODO-equivalent note below), so no cross-module function reference was needed.
--
-- SEQUENCING: `drivers.department_id` references `departments(id)`, per AGENTS.md's "cross
-- -module joins are first-class" model — `db/team-members`'s migration (which creates
-- `departments`) must run BEFORE this one, or this CREATE TABLE fails outright (Postgres
-- validates the FK target exists at creation time, not just on insert).

create type driver_status as enum ('active', 'inactive');

create table drivers (
  id uuid primary key default gen_random_uuid(),
  driver_code text unique not null,
  full_name text not null,
  photo_path text,
  phone text,
  department_id uuid references departments(id),
  status driver_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index drivers_department_id_idx on drivers(department_id);
create index drivers_status_idx on drivers(status);

create table guests (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id),
  full_name text not null,
  phone text not null unique, -- full E.164, country code included
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table feedback (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references drivers(id),
  reviewer_auth_user_id uuid not null references auth.users(id),
  travel_date date not null,
  rating smallint not null check (rating between 1 and 5),
  description text,
  created_at timestamptz not null default now()
);

create index feedback_driver_id_idx on feedback(driver_id);
create index feedback_reviewer_auth_user_id_idx on feedback(reviewer_auth_user_id);

-- RLS ---------------------------------------------------------------------

alter table drivers enable row level security;
alter table guests enable row level security;
alter table feedback enable row level security;

create policy drivers_select_active on drivers
  for select to authenticated
  using (status = 'active');

-- No INSERT/UPDATE policy for `authenticated` yet — drivers are seeded out-of-band this
-- phase (Supabase Studio / Internal Portal, Phase 2). Only the service role (which
-- bypasses RLS) can write until a `drivers.manage` permission check exists. TODO: once
-- team-members' RBAC functions are migrated, add:
--   for insert/update to authenticated with check (employee_has_permission(current_employee_id(), 'drivers.manage'))

create policy guests_select_self on guests
  for select to authenticated
  using (auth_user_id = auth.uid());
-- No INSERT/UPDATE policy — only the guest-signup edge function (service role) writes here.

create policy feedback_select_own on feedback
  for select to authenticated
  using (reviewer_auth_user_id = auth.uid());
-- No INSERT/UPDATE policy — only the submit-feedback edge function (service role) writes here.
