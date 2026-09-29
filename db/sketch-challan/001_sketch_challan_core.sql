-- Sketch Challan core schema.
-- WRITTEN 2026-09-23. REVISED 2026-09-28 to match the app: Excel intake (no PDF), three roles
-- (Sketching Manager, Sketcher, Admin), Done -> Sketch approval, handover requests, live Excel fields.
-- NOT APPLIED. Apply only after the design review (AGENTS.md section 3.1) and after verifying the live
-- Supabase target. Depends on db/team-members (employees, apps, roles, permissions, employee_roles).

create type sketch_challan_source_type as enum ('excel', 'api');
create type sketch_challan_status as enum ('active', 'on_hold', 'completed', 'cancelled');
create type sketch_challan_priority as enum ('urgent', 'high', 'normal', 'low');
-- submitted = the holder pressed Done; the Sketching Manager approves it (completed) or sends it back (assigned).
create type sketch_challan_task_status as enum ('assigned', 'in_progress', 'blocked', 'clarification_requested', 'submitted', 'completed');
create type sketch_challan_change_request_status as enum ('pending', 'approved', 'rejected');
create type sketch_challan_activity_type as enum (
  'created', 'excel_refreshed', 'details_updated', 'remark_updated',
  'task_assigned', 'task_started', 'task_blocked', 'clarification_requested',
  'task_submitted', 'task_sent_back', 'task_completed', 'task_transferred',
  'comment_added', 'held', 'resumed', 'completed', 'reopened', 'cancelled',
  'priority_changed', 'due_date_changed', 'restored',
  'change_requested', 'change_approved', 'change_rejected'
);
create type sketch_challan_notification_type as enum ('assignment', 'task_update', 'challan_update', 'reminder', 'transfer', 'system');

-- App role keys mapped to the shared roles catalog. An employee holds a role through employees.primary_role_id
-- (how the Hub assigns roles) or a current employee_roles row; private.sketch_challan_has_role checks both.
create table sketch_challan_role_bindings (
  role_key text primary key check (role_key in ('sketching_manager', 'sketcher', 'admin')),
  role_id uuid not null unique references roles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table sketch_challans (
  id uuid primary key default gen_random_uuid(),
  source_type sketch_challan_source_type not null default 'excel',
  external_source_id text,
  created_by_employee_id uuid references employees(id),
  source_actor_label text not null,
  production_order_no text not null unique,
  map_no text not null default '',
  -- The report row as read (report name + raw columns), kept for audit.
  original_source_payload jsonb not null default '{}'::jsonb,
  -- Fields the last live Excel refresh supplied (filled cells only); only these are overwritten next time.
  excel_fields text[] not null default '{}',
  -- NAV reports leave many of these blank, so blank is allowed; the Sketching Manager fills them in.
  challan_date date,
  draftsman text not null default '',
  -- '' until the Sketching Manager picks one. The 16 office spellings are kept exactly (incl. "Wirth Adjustment").
  sketch_category text not null default '' check (sketch_category = '' or sketch_category in (
    'Copy Paste', 'Copy Paste Setting', 'Side Setting Repeat', 'Side Setting Develop',
    'Scale Easy', 'Scale Medium', 'Scale Hard',
    'Border Copy paste, Bicha copy paste setting', 'Border setting, Bicha setting',
    'Border Copy paste, Bicha Scale', 'Border Scale, Bicha Copy paste',
    'Design + Texcure+ Colouring', 'Length Adjustment', 'Wirth Adjustment',
    'Unfinishing', 'Layout accordingly Swatch file create'
  )),
  size_type text not null default '',
  developer text not null default '',
  order_count integer not null default 1 check (order_count > 0),
  design text not null default '',
  ground text not null default '',
  border text not null default '',
  matching_code text not null default '',
  substitute_design text not null default '',
  order_size text not null default '',        -- NAV order size, e.g. 4'11X7'10 (map size comes from the DND rules)
  map_size_note text not null default '',
  description text not null default '',
  design_remarks text not null default '',     -- app: managerRemark1 ("Design Remarks")
  substitute_remarks text not null default '', -- app: managerRemark2 ("Substitute Remarks")
  sketcher_remark text not null default '',    -- app: sketcherRemark, written only by a current part holder
  status sketch_challan_status not null default 'active',
  priority sketch_challan_priority not null default 'normal',
  due_date date,
  original_due_date date,
  hold_started_at timestamptz,
  accumulated_hold_minutes integer not null default 0 check (accumulated_hold_minutes >= 0),
  due_date_override_reason text,
  completed_at timestamptz,
  completed_by uuid references employees(id),
  cancelled_at timestamptz,
  cancelled_by uuid references employees(id),
  cancellation_reason text,
  reopened_at timestamptz,
  reopened_by uuid references employees(id),
  reopen_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (btrim(production_order_no) <> '' and btrim(source_actor_label) <> ''),
  check ((status = 'on_hold') = (hold_started_at is not null)),
  check ((status = 'cancelled') = (cancelled_at is not null))
);

-- One line per challan today (line_no 1); the table allows more for future multi-item reports.
create table sketch_challan_items (
  id uuid primary key default gen_random_uuid(),
  challan_id uuid not null references sketch_challans(id) on delete restrict,
  line_no integer not null check (line_no > 0),
  quality text not null default '',
  shape text not null default '',
  map_width_ft numeric(12,3) not null default 0 check (map_width_ft >= 0),
  map_length_ft numeric(12,3) not null default 0 check (map_length_ft >= 0),
  area_sq_ft numeric(14,3) not null default 0 check (area_sq_ft >= 0),
  quantity integer not null default 1 check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (challan_id, line_no)
);

create table sketch_challan_tasks (
  id uuid primary key default gen_random_uuid(),
  challan_id uuid not null references sketch_challans(id) on delete restrict,
  title text not null,
  assigned_part text not null,
  status sketch_challan_task_status not null default 'assigned',
  current_sketcher_id uuid not null references employees(id),
  assigned_by uuid not null references employees(id),
  assigned_at timestamptz not null default now(),
  started_at timestamptz,
  submitted_at timestamptz,
  completed_at timestamptz,
  blocked_reason text,
  clarification_question text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (btrim(title) <> '' and btrim(assigned_part) <> '')
);

create table sketch_challan_task_assignments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references sketch_challan_tasks(id) on delete restrict,
  sketcher_id uuid not null references employees(id),
  assigned_by uuid not null references employees(id),
  assigned_at timestamptz not null default now(),
  assigned_on date not null default (now() at time zone 'Asia/Kolkata')::date,
  unassigned_at timestamptz,
  work_started_on date,
  work_ended_on date,
  excluded_work_dates date[] not null default '{}',
  transfer_reason text,
  check (work_ended_on is null or work_started_on is null or work_ended_on >= work_started_on),
  unique (task_id, assigned_at)
);

create unique index sketch_challan_one_current_assignment_idx
  on sketch_challan_task_assignments(task_id) where unassigned_at is null;

create table sketch_challan_change_requests (
  id uuid primary key default gen_random_uuid(),
  challan_id uuid not null references sketch_challans(id) on delete restrict,
  requested_by uuid not null references employees(id),
  requested_at timestamptz not null default now(),
  reason text not null check (btrim(reason) <> ''),
  -- May be empty: a reason-only request asks Admin for an extra part, a handover request carries `handover`.
  proposed_changes jsonb not null default '{}'::jsonb check (jsonb_typeof(proposed_changes) = 'object'),
  -- { taskId, sketcherId, effectiveOn, reason, excludedDates }; approving applies the handover.
  handover jsonb check (handover is null or jsonb_typeof(handover) = 'object'),
  status sketch_challan_change_request_status not null default 'pending',
  reviewed_by uuid references employees(id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'pending') = (reviewed_at is null))
);

create unique index sketch_challan_one_pending_change_idx
  on sketch_challan_change_requests(challan_id) where status = 'pending';

create table sketch_challan_versions (
  id uuid primary key default gen_random_uuid(),
  challan_id uuid not null references sketch_challans(id) on delete restrict,
  version_no bigint not null,
  actor_employee_id uuid references employees(id),
  actor_label text not null,
  origin text not null,
  snapshot jsonb not null,
  changes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (challan_id, version_no)
);

create table sketch_challan_activity (
  id uuid primary key default gen_random_uuid(),
  challan_id uuid not null references sketch_challans(id) on delete restrict,
  task_id uuid references sketch_challan_tasks(id) on delete restrict,
  activity_type sketch_challan_activity_type not null,
  actor_employee_id uuid references employees(id),
  actor_label text not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table sketch_challan_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_employee_id uuid not null references employees(id),
  challan_id uuid not null references sketch_challans(id) on delete restrict,
  task_id uuid references sketch_challan_tasks(id) on delete restrict,
  notification_type sketch_challan_notification_type not null,
  title text not null,
  message text not null,
  dedupe_key text not null unique,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index sketch_challans_queue_idx on sketch_challans(status, priority, due_date, created_at);
create index sketch_challans_filters_idx on sketch_challans(sketch_category, design, created_at, completed_at);
create index sketch_challan_tasks_challan_idx on sketch_challan_tasks(challan_id, status);
create index sketch_challan_tasks_sketcher_idx on sketch_challan_tasks(current_sketcher_id, status);
create index sketch_challan_task_assignments_sketcher_idx on sketch_challan_task_assignments(sketcher_id, unassigned_at);
create index sketch_challan_activity_challan_idx on sketch_challan_activity(challan_id, created_at desc);
create index sketch_challan_notifications_recipient_idx on sketch_challan_notifications(recipient_employee_id, read_at, created_at desc);

create function private.reject_sketch_challan_audit_mutation()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  raise exception 'sketch challan audit rows are immutable';
end;
$$;

create trigger sketch_challan_versions_immutable before update or delete on sketch_challan_versions
for each row execute function private.reject_sketch_challan_audit_mutation();
create trigger sketch_challan_activity_immutable before update or delete on sketch_challan_activity
for each row execute function private.reject_sketch_challan_audit_mutation();
create trigger sketch_challan_versions_no_truncate before truncate on sketch_challan_versions
for each statement execute function private.reject_sketch_challan_audit_mutation();
create trigger sketch_challan_activity_no_truncate before truncate on sketch_challan_activity
for each statement execute function private.reject_sketch_challan_audit_mutation();

-- RLS is switched on here, not only in 002: if 002 is ever missing, every table is closed rather than open to
-- the anon key. 002 adds the SELECT policies; there are no write policies (writes go through 003's RPC).
alter table sketch_challan_role_bindings enable row level security;
alter table sketch_challans enable row level security;
alter table sketch_challan_items enable row level security;
alter table sketch_challan_tasks enable row level security;
alter table sketch_challan_task_assignments enable row level security;
alter table sketch_challan_change_requests enable row level security;
alter table sketch_challan_versions enable row level security;
alter table sketch_challan_activity enable row level security;
alter table sketch_challan_notifications enable row level security;

-- Nobody but the security-definer RPC (003) writes these: no direct insert either, so the history can't be padded.
revoke insert, update, delete, truncate on sketch_challan_versions from anon, authenticated;
revoke insert, update, delete, truncate on sketch_challan_activity from anon, authenticated;
revoke insert, update, delete, truncate on sketch_challan_versions from service_role;
revoke insert, update, delete, truncate on sketch_challan_activity from service_role;
