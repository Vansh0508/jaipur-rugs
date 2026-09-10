-- Orders module, file 4. "One universal portal with ownership" — the workflow layer
-- that replaces the email relay quantified in the Milan folder analysis (1,088 emails /
-- 2 months, one market; 38% from a single ops person). Prototyped and load-tested
-- against the real live ERP feed in a local preview tool before writing this migration
-- (see architecture.md and apps/atlas/README.md) — every design choice below was
-- verified working end-to-end there first, not invented at migration time.
--
-- NOT YET APPLIED — same "written, not proof of applied" status as 001-003. See
-- db/MIGRATIONS.md's Pending section.

-- STATUS: extends the enum from 002 with the two states the preview proved necessary —
-- 'blocked' (waiting on a real dependency, e.g. a warehouse post waiting on its own
-- create-warehouse's Warehouse No) and re-using the existing name for everything else.
create type order_request_status as enum ('open', 'in_progress', 'blocked', 'done', 'rejected');

-- REQUEST_TYPES: data-driven, like `stages` — a new request type (samples, tag
-- printing — the two biggest email categories in the corpus after the order-lifecycle
-- ones) is a row insert, not a migration. `owning_department_code` matches `departments.code`.
create table request_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  display_name text not null,
  owning_department_code text not null,
  -- Location-dependent routing (QC only, so far): mzpreview@ when the carpet's current
  -- ERP status is in Mirzapur, carpet.r@ (HO) otherwise — same rule as the email world.
  location_dependent boolean not null default false,
  created_at timestamptz not null default now()
);

insert into request_types (code, display_name, owning_department_code, location_dependent) values
  ('process_order', 'Order punch (NAV)', 'nav', false),
  ('create_warehouse', 'Create warehouse (NAV)', 'nav', false),
  ('post_warehouse', 'Post warehouse (NAV)', 'nav', false),
  ('qc_review', 'QC review', 'qc', true)
on conflict (code) do nothing;

-- ORDER_REQUESTS: the structured replacement for order@/mzpreview@ email. No
-- INSERT/UPDATE policy (see 002's posture) — every write goes through
-- orders-create-request / orders-action-request, which re-check department access via
-- requireAtlasAccess exactly like orders-update-stage already does.
--
-- PSFT and the ack numbers (SO no., Warehouse No) are requester-supplied fields on this
-- table, NOT a separate approval step — there is no accounts department in Atlas
-- (corrected 2026-08-25); the backend already knows/sources PSFT, same as the emails
-- ("PSFT : 0.75 GBP" inside the create-warehouse mail itself) always carried it.
create table order_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  request_type_id uuid not null references request_types(id),
  status order_request_status not null default 'open',
  -- Set only when status = 'blocked'; cleared (null) once unblocked. Free text, not an
  -- enum — the exact dependency varies per request type and the preview showed the
  -- message needs to be specific ("Warehouse No — create warehouse first") to be useful.
  blocked_reason text,
  psft text,             -- requester-supplied, required at create_warehouse
  so_no text,             -- captured when process_order is marked done — the ack IS the number
  warehouse_no text,      -- captured when create_warehouse is marked done — referenced by every later step
  note text,
  requested_by uuid not null references employees(id),
  actioned_by uuid references employees(id),
  created_at timestamptz not null default now(),
  actioned_at timestamptz
);

create index order_requests_order_id_idx on order_requests(order_id);
create index order_requests_status_idx on order_requests(status);
create index order_requests_type_idx on order_requests(request_type_id);

-- ORDER_REQUEST_SEEN: the "seen but not actioned" receipt — kills the "maine dekha
-- nahi" excuse. One row per (request, viewer); in production this should be written
-- automatically on first open of a request while signed in, not a manual button.
create table order_request_seen (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references order_requests(id) on delete cascade,
  employee_id uuid not null references employees(id),
  seen_at timestamptz not null default now(),
  unique (request_id, employee_id)
);

-- ORDER_MILESTONES: the lifecycle spine ERP doesn't model (QC done, packed, dispatched,
-- AWB issued). Punched/in-production/ready/warehouse-posted are DERIVED at read time
-- from `orders`/`order_stage_events`/the `Warehouse Shipment Created` ERP flag — never
-- written here, so there's no "two sources of truth" risk for those four.
create type order_milestone_key as enum ('qc_done', 'packed', 'dispatched', 'awb_issued');

create table order_milestones (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  milestone order_milestone_key not null,
  occurred_at timestamptz not null default now(),
  recorded_by uuid references employees(id),
  -- For awb_issued, this IS the AWB number (the merchant/order-detail tracking link is
  -- generated from it) — not a free-text comment for that one milestone.
  note text,
  created_at timestamptz not null default now(),
  unique (order_id, milestone)
);

-- ORDER_EVENTS: the append-only official record replacing email's evidentiary role
-- ("see, you said this over mail"). Every mutation across this whole module writes one
-- row here with a FROZEN payload snapshot. UPDATE and DELETE are revoked for every
-- role below, including service_role via table privileges (not just RLS, which
-- postgres itself bypasses) — a correction is a new event, never an edit. Even an
-- admin cannot rewrite this table's history through the schema itself.
create table order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  actor_employee_id uuid references employees(id), -- null for system-generated events (auto-unblock, auto-filed dependency)
  actor_label text not null,                         -- display label at time of write ("Atlas (system)", "Sunil Kumar Jangid") — frozen, not a live join
  role text,
  action text not null,
  snapshot jsonb,
  created_at timestamptz not null default now()
);

create index order_events_order_id_created_at_idx on order_events(order_id, created_at);

revoke update, delete on order_events from authenticated, anon, service_role;
-- INSERT stays available to service_role only (no client, including admin, writes here
-- directly — always through the write functions, same posture as every other table).

-- ESCALATION_LEVELS: the REAL named production-escalation chain (Yogesh Chaudhary,
-- 2026-08-25) — data-driven so the chain can be edited (a person changes role, a level
-- gets added) without a migration. `notify_employee_id` starts null: Amit Dagar,
-- Vishal Verma, Sumit Yadav, and Yogesh Chaudhary don't have employee accounts in this
-- project yet (created via Hub's signup, not this migration) — link each level's
-- employee_id once those accounts exist. Until linked, escalation still records WHO
-- and WHEN correctly; it just can't yet notify or grant that person a personal queue.
create table escalation_levels (
  level int primary key,
  label text not null,
  notify_employee_id uuid references employees(id),
  created_at timestamptz not null default now()
);

insert into escalation_levels (level, label) values
  (1, 'Amit Dagar'),
  (2, 'Vishal Verma (COO – Supply Chain) & Sumit Yadav (Sales & Ops Manager – Intl/Domestic)'),
  (3, 'Yogesh Chaudhary (Director)')
on conflict (level) do nothing;

-- ORDER_ESCALATIONS: one row per manual escalation. The level an order is CURRENTLY at
-- is `max(level) for that order_id` — computed, not stored redundantly. Climbs one rung
-- per call; self-caps at level 3 (nowhere further to go) — no arbitrary rate limit
-- needed, unlike an earlier per-person-per-week design this replaces.
create table order_escalations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  level int not null references escalation_levels(level),
  escalated_by uuid not null references employees(id),
  reason text,
  created_at timestamptz not null default now()
);

create index order_escalations_order_id_idx on order_escalations(order_id);

-- Department seed for the two roles this module adds beyond 001's production/shipping/sales.
insert into departments (name, code) values
  ('NAV / Order Processing', 'nav'),
  ('QC Review', 'qc')
on conflict (code) do nothing;

-- RLS -----------------------------------------------------------------------------------
-- Same posture as 002: SELECT-only, no INSERT/UPDATE/DELETE policy anywhere in this
-- file — every write goes through service-role Edge Functions
-- (orders-create-request, orders-action-request, orders-record-milestone,
-- orders-escalate-order, orders-mark-request-seen), each re-checking department access
-- via requireAtlasAccess (supabase/functions/_shared/authz.ts), same as
-- orders-update-stage already does. Visibility follows the parent order via the
-- existing private.can_view_order() — one primitive, not re-derived five times.

alter table request_types enable row level security;
alter table order_requests enable row level security;
alter table order_request_seen enable row level security;
alter table order_milestones enable row level security;
alter table order_events enable row level security;
alter table escalation_levels enable row level security;
alter table order_escalations enable row level security;

create policy request_types_select_all on request_types for select to authenticated using (true);
create policy escalation_levels_select_all on escalation_levels for select to authenticated using (true);

create policy order_requests_select on order_requests for select to authenticated
  using (private.can_view_order(order_id));

create policy order_request_seen_select on order_request_seen for select to authenticated
  using (exists (select 1 from order_requests r where r.id = order_request_seen.request_id and private.can_view_order(r.order_id)));

create policy order_milestones_select on order_milestones for select to authenticated
  using (private.can_view_order(order_id));

-- No action in this module currently writes a null-order_id event (every write function
-- always has an order), so the null branch below is unused today — restricted to
-- orders.read.all rather than left open, on the deny-by-default principle, in case a
-- future org-wide event (not tied to one order) ever lands here.
create policy order_events_select on order_events for select to authenticated
  using (
    (order_id is not null and private.can_view_order(order_id))
    or (order_id is null and private.employee_has_permission(private.current_employee_id(), 'orders.read.all'))
  );

create policy order_escalations_select on order_escalations for select to authenticated
  using (private.can_view_order(order_id));
