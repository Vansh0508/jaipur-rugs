-- Orders module, file 1/3. Core schema: STAGES, STATUS_STAGE_MAP, ORDERS,
-- ORDER_STAGE_EVENTS, SHIPPING_DETAILS, MERCHANTS, MERCHANT_CUSTOMER_CODES, plus an
-- extension of the existing `employees` table (salesperson_code) — same precedent as
-- the journeys module extending `vehicles`/`drivers` rather than creating parallel
-- tables. See orders-schema.mmd for the ERD and README.md for the plain-language
-- entities + full ERP field mapping this reflects.
--
-- Written directly against `private` for every internal helper function, from the
-- start — AGENTS.md Section 10 records that team-members' equivalent helpers had to be
-- moved there in a follow-up migration after the security advisor caught them being
-- auto-exposed as public RPC endpoints. Not repeating that here.
--
-- NOT YET APPLIED to matnispbauvvlnbsuzxq as of this commit — see db/MIGRATIONS.md's
-- "Pending" section. Whoever applies this must run the security/performance advisors
-- immediately after (Section 3.1 step 5) and record the result there, same as every
-- other module.

create type shipping_quote_status as enum ('not_requested', 'requested', 'quoted', 'booked');
create type stage_event_source as enum ('erp_sync', 'manual');

-- STAGES: the configurable stage list. Deliberately a plain reference table, not a
-- Postgres enum — the build prompt is explicit that the real stage list is still being
-- finalized in a separate meeting, so renaming/adding/reordering a stage must be a row
-- edit, not a migration. Seeded below with the buckets already validated live in the
-- old tool (`Track JR Orders`' STATUS_TO_STAGE table) as a working starting point.
create table stages (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  display_name text not null,
  display_order int not null,
  is_terminal boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- STATUS_STAGE_MAP: raw ERP `Current Status` value -> resolved stage. `is_prefix` rows
-- (e.g. "Consignee Loc-") cover values not seen yet in a whole family (a new Indian
-- state added to the Consignee Loc- list needs zero schema/code changes). Exact rows
-- are checked first, then prefix rows, longest-prefix-first, in the sync function.
create table status_stage_map (
  id uuid primary key default gen_random_uuid(),
  raw_status text not null,
  is_prefix boolean not null default false,
  stage_id uuid not null references stages(id),
  created_at timestamptz not null default now(),
  unique (raw_status, is_prefix)
);

create index status_stage_map_stage_id_idx on status_stage_map(stage_id);

-- ORDERS: one row per ERP `Item No_` (the physical rug/carpet unit). `item_no` is the
-- upsert key — it's the true one-per-physical-unit natural key; `otn_no` is tracked
-- alongside (per the build prompt's "keyed on OTN No. / Item No.") but is not assumed
-- unique on its own, since the ERP's own naming ("Order Tracking Number") doesn't
-- guarantee a 1:1 with items the way Item No_ does. Written to ONLY by the orders-sync
-- service-role function — no client, including admin, has an insert/update RLS policy
-- on this table (same "no write policy, writes go through a service-role function"
-- posture as `journeys`/`vehicles`/`drivers`).
create table orders (
  id uuid primary key default gen_random_uuid(),

  -- Identity / ERP correlation
  otn_no text not null,
  item_no text not null,
  sales_order_no text,
  serial_no text,
  production_order_no text,

  -- Parties
  customer_no text,
  merchant_name text,
  order_wise_merchant text,
  customer_po_no text,
  salesperson_code text,

  -- Stage / status
  raw_current_status text,
  stage_id uuid references stages(id),
  current_status_pending_days int,
  production_order_status text,
  on_hold text,
  order_priority int,
  "authorization" text, -- reserved word in Postgres (CREATE/SET ... AUTHORIZATION) — must stay quoted
  remark text,

  -- Product detail
  quality text,
  design text,
  size text,
  size_cm text,
  shape text,
  construction text,
  india_collection text,
  pile_fibre text,
  pile_height text,
  gr_color_name text,
  br_color_name text,
  matching_code text,
  backing text,
  std_cubage numeric,
  item_description text,
  us_item_code text,
  quick_ship boolean not null default false,
  warehouse_shipment_created boolean not null default false,

  -- Dates
  sales_order_date date,
  revised_ex_factory_date date,
  original_ex_factory_date date,
  promised_delivery_date date,
  expected_ready_date date,

  -- Ownership (mapped/displayed only, per the build prompt — no ownership model here)
  follow_up_person text,
  project_coordinator text,

  erp_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (item_no)
);

create index orders_otn_no_idx on orders(otn_no);
create index orders_customer_no_idx on orders(customer_no);
create index orders_salesperson_code_idx on orders(salesperson_code);
create index orders_stage_id_idx on orders(stage_id);
create index orders_promised_delivery_date_idx on orders(promised_delivery_date);

-- ORDER_STAGE_EVENTS: TAT source of truth. No stored duration column — per-stage TAT is
-- derived (next event's entered_at minus this one's, or now() for the current stage).
-- orders-sync inserts a row only when an order's resolved stage actually changes between
-- syncs, or backfills exactly one row on an order's first-ever sync using the ERP's own
-- `Current Staus Pending Days` counter (entered_at = now() - pending_days), so TAT
-- reporting has a real starting point without waiting to observe a live transition.
create table order_stage_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  stage_id uuid not null references stages(id),
  entered_at timestamptz not null,
  source stage_event_source not null default 'erp_sync',
  recorded_by uuid references employees(id), -- null for erp_sync; set for 'manual' corrections
  created_at timestamptz not null default now(),
  unique (order_id, stage_id, entered_at)
);

create index order_stage_events_order_id_entered_at_idx on order_stage_events(order_id, entered_at desc);

-- SHIPPING_DETAILS: populated by production/shipping as early as they can estimate,
-- independent of whether the item is physically ready yet — this is what lets logistics
-- pre-quote large/oversized pieces instead of a multi-day back-and-forth after the fact.
create table shipping_details (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references orders(id) on delete cascade,
  weight_kg numeric,
  length_cm numeric,
  width_cm numeric,
  height_cm numeric,
  foldable boolean,
  carrier text,
  quote_status shipping_quote_status not null default 'not_requested',
  notes text,
  updated_by uuid references employees(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- MERCHANTS / MERCHANT_CUSTOMER_CODES: replaces the old tool's hardcoded STORE_CUSTOMERS
-- JS map with real rows + RLS. `clerk_user_id` stays null until the person actually
-- signs in via Clerk and merchants-link-clerk-account matches their verified email to a
-- pre-seeded row here — never auto-created from an unrecognized sign-in (unlike
-- guest-signup's create-on-demand model, which doesn't fit a paying external customer).
create table merchants (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  primary_contact_email text not null,
  clerk_user_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index merchants_primary_contact_email_idx on merchants(lower(primary_contact_email));

-- One merchant can legitimately cover several ERP customer codes at once — the old
-- tool's '7333' login alone covered ten codes across Dubai/Milan/Singapore/London.
create table merchant_customer_codes (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  customer_no text not null,
  created_at timestamptz not null default now(),
  unique (merchant_id, customer_no)
);

create index merchant_customer_codes_customer_no_idx on merchant_customer_codes(customer_no);

-- EMPLOYEES extension: lets a Sales-role employee's own row be matched against
-- orders.salesperson_code — the same scoping the old tool did by login code, now a real
-- column instead of a client-side map. Nullable (most employees aren't sales reps) and
-- unique when set (one salesperson code shouldn't silently apply to two people).
alter table employees add column salesperson_code text unique;

-- Helper functions (private schema from the start; see header comment) ----------------

create function private.current_employee_salesperson_code()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select salesperson_code from employees where auth_user_id = (select auth.uid());
$$;

-- Any department_access_grants row on the given department code counts as read access
-- for Phase 1 (the director's ask is one shared page for production/shipping/sales, not
-- a re-litigation of internal who-sees-what) — write authorization (which needs
-- 'manage'/'admin') is checked separately, inline, by each write edge function via
-- supabase/functions/_shared/authz.ts (private.* functions aren't PostgREST-exposed to
-- ANY caller, service-role included, so edge functions re-implement this as plain
-- queries rather than calling it directly — see that file's own comment).
create function private.has_atlas_department_access(emp_id uuid, dept_code text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from department_access_grants dag
    join departments d on d.id = dag.department_id
    where dag.employee_id = emp_id
      and d.code = dept_code
  );
$$;

-- Single authorization primitive for orders/order_stage_events/shipping_details SELECT
-- policies (002_orders_rls.sql) — one place to define "who can see this order" so it
-- isn't re-derived three times across three tables' policies. SECURITY DEFINER so the
-- internal `orders`/`merchant_customer_codes` lookups bypass THIS function's own caller's
-- RLS context, the same recursion-avoidance technique as
-- private.current_employee_department_id() (db/team-members/005_fix_employees_select_recursion.sql).
--
-- Merchant branch reads the Clerk-issued JWT's `sub` claim directly via auth.jwt() —
-- requires Clerk configured as a Supabase Third-Party Auth provider (AGENTS.md Section 1,
-- "Recorded override" — a one-time Supabase Dashboard step, not something a migration can
-- do). Until that's configured, a Clerk-authenticated request's role is NOT
-- 'authenticated' from Postgres's point of view, so this policy simply won't match for
-- merchants yet — fails closed, not open.
create function private.can_view_order(target_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from orders o
    where o.id = target_order_id
      and (
        private.employee_has_permission(private.current_employee_id(), 'orders.read.all')
        or private.has_atlas_department_access(private.current_employee_id(), 'production')
        or private.has_atlas_department_access(private.current_employee_id(), 'shipping')
        or private.has_atlas_department_access(private.current_employee_id(), 'sales')
        or (
          private.current_employee_salesperson_code() is not null
          and o.salesperson_code = private.current_employee_salesperson_code()
        )
        or exists (
          select 1
          from merchant_customer_codes mcc
          join merchants m on m.id = mcc.merchant_id
          where m.clerk_user_id = (select auth.jwt() ->> 'sub')
            and mcc.customer_no = o.customer_no
        )
      )
  );
$$;

-- Seed data ---------------------------------------------------------------------------

-- App registry + permission catalog entries for this module (mirrors team-members'
-- 001 seed of `apps`/`permissions` — see db/team-members/001_team_members_schema.sql).
insert into apps (key, name, description) values
  ('atlas', 'Atlas', 'Unified order visibility: merchant, production, shipping, sales')
on conflict (key) do nothing;

insert into permissions (key, description) values
  ('orders.read.all', 'Read every order regardless of department grant or salesperson scope (Atlas admin)'),
  ('orders.write.all', 'Correct any order''s stage or shipping details (Atlas admin)')
on conflict (key) do nothing;

-- Department rows Atlas's department_access_grants checks match against. Same idiom as
-- db/team-members/004_seed_admin_departments.sql's 'admin'/'pixxel' rows — these are
-- access-gating labels for this module, not a claim about the real HR org chart.
insert into departments (name, code) values
  ('Production', 'production'),
  ('Shipping', 'shipping'),
  ('Sales', 'sales')
on conflict (code) do nothing;

-- Stages: the validated buckets already live in the old tool, plus a terminal
-- 'Delivered' the old tool never modeled explicitly (its ERP feed has no "delivered"
-- status distinct from the various warehouse/consignee locations — flagged here as a
-- known gap for whoever finalizes the real stage list in the TAT meeting) and an 'Other'
-- catch-all for anything status_stage_map doesn't resolve. Purely data — add, rename, or
-- reorder rows here without touching any code.
insert into stages (code, display_name, display_order, is_terminal) values
  ('pre_loom', 'Pre-Loom', 10, false),
  ('loom', 'Loom', 20, false),
  ('purchase', 'Purchase', 30, false),
  ('finish', 'Finishing', 40, false),
  ('consignee', 'Consignee', 50, false),
  ('delivered', 'Delivered', 60, true),
  ('rejected', 'Rejected', 70, true),
  ('other', 'Other', 80, false)
on conflict (code) do nothing;

-- Exact-match rows, extracted verbatim from the old tool's STATUS_TO_STAGE table (see
-- db/orders/README.md — "pull the old tool's source for field mappings" from the
-- migration checklist). Encoded as one INSERT per (raw_status, stage_code) pair via a
-- VALUES list joined against `stages` on code, rather than hand-writing 130+ separate
-- statements.
insert into status_stage_map (raw_status, is_prefix, stage_id)
select v.raw_status, false, s.id
from (values
  ('Amare', 'finish'),
  ('Andheri(W) Retail Store (Mumbai)', 'finish'),
  ('At Branch', 'loom'),
  ('At Design - D&D', 'pre_loom'),
  ('At Design - Operations', 'pre_loom'),
  ('At Design - Planning', 'pre_loom'),
  ('At Design - R&D', 'pre_loom'),
  ('At Ecom Planning', 'pre_loom'),
  ('At Loom', 'loom'),
  ('At MZP Stores', 'pre_loom'),
  ('At Order Process', 'pre_loom'),
  ('At PPC', 'pre_loom'),
  ('At Purchase', 'purchase'),
  ('At Stores', 'pre_loom'),
  ('At Stores (Packed)', 'pre_loom'),
  ('Bajrang Lifestyle', 'finish'),
  ('Bhadohi Binding', 'finish'),
  ('Bhadohi Final Finishing - Knotted', 'finish'),
  ('Bhadohi Finished Carpet Location', 'finish'),
  ('Bhadohi Stretching', 'finish'),
  ('Bhadohi Unfinished Location', 'finish'),
  ('Bureau Veritas Conssumer Products Services (I) P.L', 'finish'),
  ('Carpet At Branch', 'finish'),
  ('Carpet At DND', 'finish'),
  ('Carpet Dyeing Location Jaipur', 'finish'),
  ('Chennai Warehouse', 'finish'),
  ('Consignee Loc-Andra Pradesh', 'consignee'),
  ('Consignee Loc-Assam', 'consignee'),
  ('Consignee Loc-Chandigarh', 'consignee'),
  ('Consignee Loc-Chhattis Garh', 'consignee'),
  ('Consignee Loc-Delhi', 'consignee'),
  ('Consignee Loc-Goa', 'consignee'),
  ('Consignee Loc-Gujarat', 'consignee'),
  ('Consignee Loc-Haryana', 'consignee'),
  ('Consignee Loc-Jharkhand', 'consignee'),
  ('Consignee Loc-Karnataka', 'consignee'),
  ('Consignee Loc-Kerala', 'consignee'),
  ('Consignee Loc-MP', 'consignee'),
  ('Consignee Loc-Maharashtra', 'consignee'),
  ('Consignee Loc-Orissa', 'consignee'),
  ('Consignee Loc-Punjab', 'consignee'),
  ('Consignee Loc-Rajasthan', 'consignee'),
  ('Consignee Loc-Tamil Nadu', 'consignee'),
  ('Consignee Loc-Telangana', 'consignee'),
  ('Consignee Loc-Uttar Pradesh', 'consignee'),
  ('Consignee Loc-Uttarakhand', 'consignee'),
  ('Consignee Loc-West Bengal', 'consignee'),
  ('Consignee Loc-Bihar', 'consignee'),
  ('D&D & R&D Inspection Area HO', 'finish'),
  ('Delhi Retail Store', 'finish'),
  ('HO - Unfinished Carpet Location', 'finish'),
  ('HO Gultarash Location Jaipur', 'finish'),
  ('Hohenstein India Private Limited', 'finish'),
  ('Indian Institute of Carpet Technology', 'finish'),
  ('Indira Nagar Retails Store(Bangalore)', 'finish'),
  ('Inhouse Carpet Finishing Center-Sadwa', 'finish'),
  ('Inhouse Dyeing Center-MZP', 'pre_loom'),
  ('Inhouse finishing center-Khore', 'finish'),
  ('Inhouse finishing center-Khore Unit-2', 'finish'),
  ('Intertek India Pvt Ltd (Gurgaon)', 'finish'),
  ('Intransit Location', 'finish'),
  ('Intransit MZP to JPR', 'finish'),
  ('JLI Inspection Location (SADWA)', 'finish'),
  ('JRCPL Raipur, CG', 'finish'),
  ('Jagatpura Warehouse', 'finish'),
  ('Jaipur (HO)  Return Location', 'finish'),
  ('Jaipur Finishing Centres (Washing) (Sadwa)', 'finish'),
  ('Jaipur Rugs - Delhi Warehouse', 'finish'),
  ('Jaipur Rugs - Koregaon Park, PUNE', 'finish'),
  ('Jaipur Rugs - PUNE SHOWROOM', 'finish'),
  ('Jaipur Rugs Co. Ltd. (Empire Complex, Mumbai)', 'finish'),
  ('Jaipur Stitching-HO (DnD)', 'finish'),
  ('Jaipur Weaving R&D', 'loom'),
  ('Kalam Birai Location-Sadwa', 'finish'),
  ('Kolkata Showroom', 'finish'),
  ('MZP Purchase Carpet Inspection', 'finish'),
  ('Malviya Nagar Warehouse', 'finish'),
  ('Master Sample- Finishing (SADWA)', 'finish'),
  ('Master Sample- Inspection (SADWA)', 'finish'),
  ('Mirzapur Binding', 'finish'),
  ('Mirzapur Embossing', 'finish'),
  ('Mirzapur Finished Carpet Warehouse', 'finish'),
  ('Mirzapur Finishing Location', 'finish'),
  ('Mirzapur Repairing center', 'finish'),
  ('Mirzapur Return Location', 'finish'),
  ('Mirzapur Unfinished Location', 'finish'),
  ('Mirzapur Washing Center', 'finish'),
  ('Modern Testing Services India Pvt. Ltd.', 'finish'),
  ('Narayan Niwas - Showroom', 'finish'),
  ('Other Customer Inspection Location (SADWA)', 'finish'),
  ('Palana Godown', 'finish'),
  ('Ramgadh Gultarash Location (Sadwa) Jaipur', 'finish'),
  ('Ramgadh Gultarash Location (Sadwa) Jaipur-GT Done', 'finish'),
  ('Ramgarh Inspection Center (Sadwa)', 'finish'),
  ('Reject Location-Head Office', 'rejected'),
  ('Reject Location-Mirzapur', 'rejected'),
  ('Reject Location-Sadwa', 'rejected'),
  ('Repairing Centre (Manoharpur)', 'finish'),
  ('Repairing Centre (Thukai) (Sadwa)', 'finish'),
  ('SADWA Packing Location', 'finish'),
  ('SGS India Private Limited', 'finish'),
  ('Sadwa Godown (Recd frm Repair)', 'finish'),
  ('Sadwa Rework Location', 'finish'),
  ('Sadwa Warehouse', 'finish'),
  ('Sadwa Warehouse Unit-II', 'finish'),
  ('Sadwa Warehouse Unit-III', 'finish'),
  ('Santosh Kumar Ahirwal', 'finish'),
  ('Showroom - G-250', 'finish'),
  ('Shyam Ahuja-Rajan House-Mumbai', 'finish'),
  ('Shyam Ahuja-Saket-Delhi', 'finish'),
  ('Surana Finished Warehouse', 'finish'),
  ('Surana Unfinished Godown', 'finish'),
  ('Surana Unit II - Production Floor', 'loom'),
  ('Surana Unit II - Rejected Carpets', 'rejected'),
  ('Surana Unit II Finishing', 'finish'),
  ('Surana Unit II RM Store', 'pre_loom'),
  ('Surana Unit II Repairing Location', 'finish'),
  ('Surana Unit II Warehouse', 'finish'),
  ('Unfinished Carpets at Khore', 'finish'),
  ('Unfinished Carpets at Khore Unit-2', 'finish'),
  ('Watson Logistics Pvt. Ltd. (Mumbai)', 'finish'),
  ('Worli Retail Store (Mumbai)', 'finish'),
  ('At Design Routing Problem(RoutingDefault)', 'pre_loom'),
  ('At Design Routing Problem(RoutingisNull)', 'pre_loom'),
  ('In-House Rug Screen Printing', 'finish'),
  ('JRCL Bangalore Whse-Triplex Residential Premises', 'finish'),
  ('Bansal Carpets', 'purchase'),
  ('Tranceforme Designs', 'finish'),
  ('THOT LIFESTYLE PRIVATE LIMITED', 'finish'),
  ('Jai Sai Ram Handloom', 'finish'),
  ('Shiv Shakti Rugs', 'finish'),
  ('Jai Amba Carpets', 'finish')
) as v(raw_status, stage_code)
join stages s on s.code = v.stage_code
on conflict (raw_status, is_prefix) do nothing;

-- Prefix fallback rows — covers "Consignee Loc-<any state not yet in the exact list
-- above>" and "Reject*" families the old tool's stageOf() pattern-matched rather than
-- exact-matched (see site-src/track-jr-order.html's stageOf(), steps 4).
insert into status_stage_map (raw_status, is_prefix, stage_id)
select v.raw_status, true, s.id
from (values
  ('Consignee Loc', 'consignee'),
  ('Reject', 'rejected')
) as v(raw_status, stage_code)
join stages s on s.code = v.stage_code
on conflict (raw_status, is_prefix) do nothing;
