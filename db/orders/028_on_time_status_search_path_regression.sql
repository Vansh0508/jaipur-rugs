-- Fixes a regression 027 introduced without meaning to: `create or replace function`
-- does NOT preserve a function's `ALTER FUNCTION ... SET search_path` setting from
-- before the replace — 025 had pinned private.orders_on_time_status's search_path,
-- 027's `create or replace function private.orders_on_time_status(...)` (needed to fix
-- the date-vs-timestamp boundary bug) silently dropped that pinning again, and the
-- function_search_path_mutable WARN came back for just this one function. Caught by
-- the advisor check that's been run after every migration this session, not missed.
--
-- Real gotcha worth remembering for any future `create or replace function` on an
-- already-`ALTER FUNCTION ... SET`-pinned function in this project: the SET doesn't
-- survive a replace, it has to be re-applied every time the function body changes.

alter function private.orders_on_time_status(date, date, boolean, numeric) set search_path = private, pg_temp;
