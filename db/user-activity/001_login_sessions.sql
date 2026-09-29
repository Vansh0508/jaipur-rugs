-- User Activity module — tracks Atlas sign-ins/session duration for the admin "User
-- Management" screen (Users see who's signed in when, how long, basic analytics).
-- See user-activity-schema.mmd for the ERD. New module, no cross-module dependency other
-- than `employees` (db/team-members/001) already existing.
--
-- Product decisions this schema encodes (Ayaan, 2026-09-27):
--   - Duration is heartbeat-based, not just login/logout: the client pings every few
--     minutes while the tab is open/focused, updating `last_heartbeat_at`. A session's
--     duration is last_heartbeat_at - started_at (or ended_at - started_at once ended) —
--     computed at query time, never stored, so it can't drift out of sync with reality.
--   - Scope is implicit, not a new allowlist: only employees who can actually sign in
--     (status = 'active' AND auth_user_id is not null) ever get a row here, which already
--     covers admins/management/production/sales/customer-code grantees alike — everyone
--     authenticates through the same Supabase Auth flow (requireAtlasStaffAccess.ts).
--   - Visibility: admin screen is gated by the SAME isAdmin check every other admin
--     surface uses (orders.read.all) — no new permission key invented for this.
--
-- Per AGENTS.md Section 9 ("no trusted app exception"): this table has NO insert/update
-- RLS policy for anyone, including admins — every write (session start, heartbeat, end)
-- goes through a service-role Edge Function under supabase/functions/login-sessions-*,
-- same posture as the journeys/orders modules. RLS only grants SELECT.

create table login_sessions (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id),
  auth_user_id uuid not null references auth.users(id), -- denormalized from employees.auth_user_id so the self-select RLS policy doesn't need a join
  started_at timestamptz not null default now(),
  last_heartbeat_at timestamptz not null default now(),
  ended_at timestamptz, -- nullable: set on explicit sign-out; a still-open session (no heartbeat recently either) just means the tab was closed without one firing
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes -----------------------------------------------------------------
-- employee_id/started_at back the admin screen's per-user history + date-range filters.
-- The partial "open session" index is what login-sessions-start uses to decide whether to
-- reuse an existing session (heartbeat within the last ~20 min) instead of inserting a new
-- row on every page navigation/tab.

create index login_sessions_employee_id_idx on login_sessions(employee_id);
create index login_sessions_auth_user_id_idx on login_sessions(auth_user_id);
create index login_sessions_started_at_idx on login_sessions(started_at);
create index login_sessions_last_heartbeat_at_idx on login_sessions(last_heartbeat_at);
create index login_sessions_open_idx on login_sessions(employee_id, last_heartbeat_at) where ended_at is null;

-- Admin analytics view ------------------------------------------------------
-- One row per employee: last sign-in, last-active timestamp, whether they're currently
-- "online" (heartbeat within the last 10 minutes and not ended), and lifetime session
-- count/total time — the exact shape the admin screen's table + summary tiles need,
-- computed in Postgres rather than pulled row-by-row into Node.
--
-- security_invoker = true (AGENTS.md 002_advisor_fixes.sql precedent): without it this
-- view would run as its owner and bypass the caller's own RLS on login_sessions/employees
-- entirely.
create view login_session_summary
with (security_invoker = true) as
select
  e.id as employee_id,
  e.full_name,
  e.employee_code,
  e.department_id,
  d.name as department_name,
  max(ls.started_at) as last_sign_in_at,
  max(coalesce(ls.ended_at, ls.last_heartbeat_at)) as last_active_at,
  bool_or(ls.ended_at is null and ls.last_heartbeat_at > now() - interval '10 minutes') as is_online,
  count(ls.id) as total_sessions,
  coalesce(sum(extract(epoch from (coalesce(ls.ended_at, ls.last_heartbeat_at) - ls.started_at))), 0)::bigint as total_seconds
from employees e
left join departments d on d.id = e.department_id
left join login_sessions ls on ls.employee_id = e.id
where e.status = 'active' and e.auth_user_id is not null
group by e.id, e.full_name, e.employee_code, e.department_id, d.name;

-- RLS -----------------------------------------------------------------------

alter table login_sessions enable row level security;

create policy login_sessions_select on login_sessions for select to authenticated
  using (
    auth_user_id = (select auth.uid())
    or private.employee_has_permission(private.current_employee_id(), 'orders.read.all')
  );

-- No insert/update/delete policy on purpose — see header comment. All writes go through
-- login-sessions-start/-heartbeat/-end (service-role client), which independently verify
-- the caller owns the session they're touching.
