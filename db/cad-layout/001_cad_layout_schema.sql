-- CAD Layout module (apps/DND/CAD Layout) — see cad-layout-schema.mmd for the ERD and
-- apps/DND/CAD Layout/PRD.md for the decisions behind it. Depends on team-members
-- (employees, apps, permissions, departments, private.current_employee_id,
-- private.employee_has_permission) being applied.
--
-- WRITTEN, NOT YET APPLIED — see db/MIGRATIONS.md before assuming any of this is live.

-- Enums ---------------------------------------------------------------------

create type cad_layout_variant as enum ('b2c', 'jli', 'b2b');
create type cad_layout_colour_order as enum ('area', 'legend', 'manual');
-- 'manual' = designer typed the GRC/ARS code in the form (today's only path);
-- 'auto_read' reserved for the Tikni-legend auto-read target (PRD 4.2 item 2).
create type cad_layout_code_source as enum ('manual', 'auto_read');

-- Tables ----------------------------------------------------------------------

create table cad_layout_records (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references employees(id),
  variant cad_layout_variant not null,
  project_no text not null default '',
  construction text not null default '',
  client_name text not null default '',
  project_type text not null default '',
  layout_date text not null default '',
  size text not null default '',
  customer_metrics text not null default '',
  shape text not null default '',
  rug_quality text not null default '',
  fibre_content text not null default '',
  dyeing_technique text not null default '',
  finish_edge text not null default '',
  pile_height text not null default '',
  pile_type text not null default '',
  backing text not null default '',
  wash text not null default '',
  width text not null default '',
  length text not null default '',
  area text not null default '',
  notes text not null default '',
  pptx_path text not null,
  pdf_path text,
  pdf_error text,
  generation_warnings text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table cad_layout_options (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references cad_layout_records(id) on delete cascade,
  sequence_no int not null check (sequence_no >= 1),
  design_code text not null default '',
  -- No source_bmp_path on purpose: the Tikni BMP is never stored (DnD, 2026-09-19 —
  -- "database me store nahi hogi"). Only the rendered, legend-cropped design image is.
  design_png_path text not null,
  -- Manually cut piece of the design at the customer's physical size, uploaded as an image.
  swatch_path text,
  bmp_width int not null,
  bmp_height int not null,
  design_height int not null,
  colour_order cad_layout_colour_order not null default 'area',
  created_at timestamptz not null default now(),
  unique (record_id, sequence_no)
);

create table cad_layout_colours (
  id uuid primary key default gen_random_uuid(),
  option_id uuid not null references cad_layout_options(id) on delete cascade,
  slot_no int not null check (slot_no >= 1),
  hex char(6) not null check (hex ~ '^[0-9A-F]{6}$'),
  area_pct numeric(6, 3) not null,
  legend_index int,
  code text not null default '',
  yarn text,
  code_source cad_layout_code_source not null default 'manual',
  created_at timestamptz not null default now(),
  unique (option_id, slot_no)
);

create table cad_layout_reference_images (
  id uuid primary key default gen_random_uuid(),
  option_id uuid not null references cad_layout_options(id) on delete cascade,
  sequence_no int not null check (sequence_no >= 1),
  storage_path text not null,
  original_filename text not null default '',
  created_at timestamptz not null default now(),
  unique (option_id, sequence_no)
);

-- Indexes (Postgres doesn't index FK columns automatically) ------------------

create index cad_layout_records_created_by_idx on cad_layout_records(created_by);
create index cad_layout_records_created_at_idx on cad_layout_records(created_at desc);
create index cad_layout_options_record_id_idx on cad_layout_options(record_id);
create index cad_layout_colours_option_id_idx on cad_layout_colours(option_id);
create index cad_layout_reference_images_option_id_idx on cad_layout_reference_images(option_id);

-- Registry seed --------------------------------------------------------------
-- App row + admin permission, same idiom as db/orders/001. 'dnd' department row so
-- DnD staff can be placed/granted like every other department (access-gating label, not
-- a claim about the HR org chart — see db/team-members/004_seed_admin_departments.sql).

insert into apps (key, name, description) values
  ('cad-layout', 'CAD Layout', 'DnD: Tikni BMP to B2C / JLI / B2B layout deck (PPTX + PDF)')
on conflict (key) do nothing;

insert into permissions (key, app_id, description)
  select 'cad_layout.admin', id, 'See every designer''s CAD layouts and the usage view (CAD Layout admin)'
  from apps where key = 'cad-layout'
on conflict (key) do nothing;

insert into departments (name, code) values ('Design & Development', 'dnd')
on conflict (code) do nothing;

-- Storage bucket ---------------------------------------------------------------
-- PRIVATE bucket (public = false): unlike driver-photos/employee-avatars, nothing here
-- may be reachable by URL — the raw Tikni BMP must never leave the system (meeting
-- 2026-09-18, 10:34). Reads go through signed URLs minted by the Edge Functions; no
-- storage.objects policy is added, so by Storage's default only the service role can
-- read or write objects. Recorded override of AGENTS.md's self-hosted-S3 default (PRD 8.3).
insert into storage.buckets (id, name, public) values ('cad-layout-files', 'cad-layout-files', false);

-- RLS ---------------------------------------------------------------------------
-- Creator sees own records; cad_layout.admin sees all (PRD 8.5). No INSERT/UPDATE/DELETE
-- policy on any table — writes are Edge Functions only (service role), the same posture
-- as journeys and orders.

alter table cad_layout_records enable row level security;
alter table cad_layout_options enable row level security;
alter table cad_layout_colours enable row level security;
alter table cad_layout_reference_images enable row level security;

create function private.can_read_cad_layout_record(record_created_by uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select record_created_by = private.current_employee_id()
      or private.employee_has_permission(private.current_employee_id(), 'cad_layout.admin');
$$;

create policy cad_layout_records_select on cad_layout_records for select to authenticated
  using (private.can_read_cad_layout_record(created_by));

create policy cad_layout_options_select on cad_layout_options for select to authenticated
  using (exists (
    select 1 from cad_layout_records r
    where r.id = cad_layout_options.record_id
      and private.can_read_cad_layout_record(r.created_by)
  ));

create policy cad_layout_colours_select on cad_layout_colours for select to authenticated
  using (exists (
    select 1 from cad_layout_options o
    join cad_layout_records r on r.id = o.record_id
    where o.id = cad_layout_colours.option_id
      and private.can_read_cad_layout_record(r.created_by)
  ));

create policy cad_layout_reference_images_select on cad_layout_reference_images for select to authenticated
  using (exists (
    select 1 from cad_layout_options o
    join cad_layout_records r on r.id = o.record_id
    where o.id = cad_layout_reference_images.option_id
      and private.can_read_cad_layout_record(r.created_by)
  ));

-- Admin usage view ----------------------------------------------------------------
-- "Who is using this tool and how much" (PRD 4.2 item 7). security_invoker so the
-- caller's RLS applies: a non-admin only ever sees their own row.
create view cad_layout_usage_view
with (security_invoker = true)
as
select
  e.id as employee_id,
  e.full_name,
  e.email,
  count(r.id) as layouts_count,
  count(r.id) filter (where r.created_at >= now() - interval '30 days') as layouts_last_30_days,
  max(r.created_at) as last_layout_at
from cad_layout_records r
join employees e on e.id = r.created_by
group by e.id, e.full_name, e.email;
