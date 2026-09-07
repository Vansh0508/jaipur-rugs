-- Direct feedback, 2026-09-07: show the Follow Up Person's real email on hover/click in
-- the Orders table (copy-ready), WITHOUT wiring up the automated delay-alert routing
-- (that's still pending a second confirmation with production — see
-- ERP_AND_EXTERNAL_REQUESTS.md request #5). This is a separate, much smaller thing: a
-- plain name -> email lookup for manual copy/paste convenience, sourced from the real
-- names that actually appear in `orders.follow_up_person` (confirmed live 2026-09-07:
-- only 10 distinct values across the whole table), cross-checked against the company
-- directory at darpan.jaipurrugs.com.
--
-- Deliberately its own small table, not a row in `employees` — these are directory
-- contacts for display purposes, not Atlas/Hub users with logins, and `employees` has
-- several NOT NULL columns (employee_code, status, employment_type) that don't apply.
create table public.follow_up_person_directory (
  id uuid primary key default gen_random_uuid(),
  -- Matches orders.follow_up_person's exact stored casing (e.g. "SURENDRA DHAKAD").
  name text not null unique,
  -- Null when no confirmed match exists in the company directory — never guessed.
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.follow_up_person_directory is
  'Name -> email lookup for the Orders table''s Follow Up Person column (hover/click to copy). Not used for automated alert routing — see ERP_AND_EXTERNAL_REQUESTS.md request #5.';

alter table public.follow_up_person_directory enable row level security;

-- Same broad-read pattern as other small reference tables (stages, status_stage_map) —
-- any authenticated staff member can read it, no client write policy (admin-maintained
-- via direct DB access for now, same as those tables).
create policy follow_up_person_directory_select on public.follow_up_person_directory
  for select
  to authenticated
  using (true);

-- Seeded from the real distinct orders.follow_up_person values (2026-09-07), matched
-- against https://darpan.jaipurrugs.com/storage/email-ext-list/email-id-list.html.
-- 4 of the 10 real names have no confirmed match there (checked directly, not a gap in
-- how thoroughly it was searched — see ERP_AND_EXTERNAL_REQUESTS.md): VISHNU PRASAD
-- NAGAR (the single biggest gap by volume — 7,962 orders), GOPAL LAL MEENA, NISHANT
-- SINGH, MAMBHU. Their rows are intentionally omitted, not inserted with a null email —
-- easy to add once/if a real address turns up.
insert into public.follow_up_person_directory (name, email) values
  ('SURENDRA DHAKAD', 'surendra.d@jaipurrugs.com'),
  ('PRAMOD KUMAR MAURYA', 'pramod.m@jaipurrugs.com'),
  ('AVINASH KUMAR', 'avinash.k@jaipurrugs.com'),
  ('NARENDRA DHAKAD', 'narendra.d@jaipurrugs.com'),
  ('MAHESH SAINI', 'mahesh.s@jaipurrugs.com'),
  ('JITENDRA TAILOR', 'jitendra.ta@jaipurrugs.com');
