-- Two changes, both direct requests, 2026-09-14:
--
-- 1. "lock the user's view acc to their user id so from any system the user logs in he
--    will view his own personalized view only" — Orders table view preferences (which
--    columns are shown, their order, which filters are hidden, row height) currently
--    live in browser localStorage (useLocalPreference, apps/atlas/lib/useLocalPreference.ts)
--    — per-DEVICE, not per-account, so the same login on a second computer starts from
--    scratch. This table is the real per-account version: one row per employee, synced
--    through a new self-service Edge Function (orders-save-view-preferences), read
--    directly here (RLS-scoped to the caller's own row, same "SELECT direct, write
--    through an Edge Function" posture as every other table in this module).
--
-- 2. "admin will approve it" — orders_column_requests (022) only had pending/added/
--    declined; there was no actual approve action, just a plain list Ayaan was expected
--    to act on out-of-band. Adds 'approved' as its own status: an admin's decision that
--    a field should be added, recorded immediately via a real button, distinct from
--    'added' (the field actually exists and is wired into orders-sync.mjs — still a real
--    migration + sync-script update + deploy, not something a click can safely automate
--    for a live, every-30-minutes ERP sync — see 022's own header on why that step stays
--    manual). Existing 'declined' behavior unchanged, now driven by a real button too via
--    the same new orders-resolve-column-request Edge Function.

alter type column_request_status add value if not exists 'approved';

create table user_orders_view_preferences (
  employee_id uuid primary key references employees(id),
  hidden_columns jsonb not null default '[]'::jsonb,
  column_order jsonb not null default '[]'::jsonb,
  hidden_filters jsonb not null default '[]'::jsonb,
  row_height text not null default 'normal',
  updated_at timestamptz not null default now()
);

alter table user_orders_view_preferences enable row level security;

-- SELECT-only, same posture as every other table in this module — a person reads only
-- their own row directly; orders-save-view-preferences (service role) is the only write
-- path, and it always upserts under the CALLER'S OWN employee_id, resolved from their
-- session server-side, never a client-supplied id.
create policy user_orders_view_preferences_select on user_orders_view_preferences for select to authenticated
  using (employee_id = private.current_employee_id());
