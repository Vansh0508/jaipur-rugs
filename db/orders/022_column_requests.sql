-- Column-request workflow — direct decision, 2026-09-12, replacing the "just add all 180
-- NAV fields now" plan (021_nav_full_field_expansion.sql, written but deliberately NOT
-- applied — see that file's own updated header). Ayaan's own words: "no load in the
-- server and database instead only that column will be added which are required and
-- requested by the user." So instead of a 180-column migration + a heavier
-- orders-sync.mjs pull up front, an employee requests ONE specific field (from the full
-- NAV catalog surfaced in ColumnSettingsMenu.tsx's "Request a column" list, sourced from
-- 021's already-verified mapping), Ayaan reviews it, and only that field gets added —
-- one small follow-up migration + one orders-sync.mjs field at a time.
--
-- This table is deliberately tiny (a handful of columns, no expected volume beyond a few
-- rows a week) — it is the whole point of the lighter-weight alternative, not itself a
-- second version of the problem it's solving.
--
-- Same "SELECT-only RLS, every write goes through a service-role Edge Function" posture
-- as every other table in this module (see 002_orders_rls.sql's header) — no insert/
-- update policy here either; requesting a column goes through the new
-- `orders-request-column` Edge Function, which sets requested_by from the caller's own
-- verified session, never from client input (same reason employee_salesperson_codes'
-- self-service insert only ever writes the CALLER'S OWN employee_id — see 010's
-- comment). Resolving a request (marking it added/declined) is a plain `execute_sql`-style
-- admin action for now, not a second Edge Function/UI writer — v1 keeps the admin side
-- manual on purpose, revisit if request volume ever makes that annoying.

create type column_request_status as enum ('pending', 'added', 'declined');

create table orders_column_requests (
  id uuid primary key default gen_random_uuid(),
  -- The exact NAV field name from NAV FORMAT.XLSX / the live NAV-002 view (e.g. "Weaver
  -- Name") — not yet a real `orders` column, by definition; free text rather than an FK,
  -- since nothing to reference exists until the request is actually fulfilled.
  nav_field_name text not null,
  requested_by uuid not null references employees(id),
  status column_request_status not null default 'pending',
  notes text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references employees(id)
);

create index orders_column_requests_status_idx on orders_column_requests(status);
create index orders_column_requests_requested_by_idx on orders_column_requests(requested_by);
-- Added same-day as a direct follow-up to the security/performance advisor's
-- unindexed_foreign_keys finding on resolved_by, right after this table was applied —
-- Section 3.1 step 5's "fix advisor findings" pass, not deferred.
create index orders_column_requests_resolved_by_idx on orders_column_requests(resolved_by);

alter table orders_column_requests enable row level security;

-- A requester sees their own requests (so the UI can show "already requested, pending");
-- org-wide admin (orders.read.all — the same permission requireAtlasStaffAccess.ts's
-- `isAdmin` already checks, reused as-is rather than inventing a second admin flag) sees
-- every request, to review and act on.
create policy orders_column_requests_select on orders_column_requests for select to authenticated
  using (
    requested_by = private.current_employee_id()
    or private.employee_has_permission(private.current_employee_id(), 'orders.read.all')
  );
