-- Orders module. Adds drag-and-drop filter reordering, matching the existing column
-- reordering feature exactly (same idiom: a saved id-order array, per account, following
-- the login across devices) -- direct request, 2026-09-19, right after the same person
-- asked for the filter bar's scrollbar to actually be visible (17 filters, ~8-9 fit on
-- screen at once) -- reordering lets each person put their most-used filters first
-- instead of always scrolling to reach one buried near the end.
alter table user_orders_view_preferences
  add column if not exists filter_order jsonb not null default '[]'::jsonb;
