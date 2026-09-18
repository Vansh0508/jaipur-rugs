-- Two fixes to 024_on_time_status_view.sql, both caught by actually testing it live
-- (not just reading it) — exactly why that migration's own header insisted on running
-- validate-on-time-status-port.mjs before wiring up the frontend, not just applying and
-- moving on.
--
-- 1. Real bug: nobody could actually query orders_with_on_time_status. The view calls
--    private.stage_standard_days()/orders_on_time_status() (which in turn call
--    private.loom_standard_days()/max_dimension_ft()) directly in its SELECT list —
--    unlike an RLS policy predicate, a view's own SELECT-list function calls need the
--    QUERYING role to hold real EXECUTE privilege on them, and `private` schema
--    functions get none by default (that's the whole point of putting them there —
--    keeps them off PostgREST's auto-exposed RPC surface). Confirmed live: even
--    service_role got `permission denied for schema private` (42501) running the
--    validation script. Granting EXECUTE here does NOT make these callable as
--    `/rest/v1/rpc/...` endpoints — PostgREST only auto-generates those for schemas in
--    its configured exposed-schema list (public here), never `private`, regardless of
--    SQL-level GRANTs — so this stays exactly as "exposed" as intended: usable from
--    inside the view, nothing more.
--
-- 2. Advisor WARN (function_search_path_mutable) on all 4 new functions from 024 — same
--    fix already applied twice before in this project for the same finding
--    (db/team-members/007_hub_advisor_fixes.sql, db/journeys/008_driver_code_helper_fixes.sql).
--    Every internal call in these 4 functions is already schema-qualified
--    (private.foo(...), never bare foo(...)), so pinning search_path doesn't change any
--    existing behavior — it just stops an unqualified name from ever being resolvable
--    against some other schema a caller controls.

grant usage on schema private to authenticated, service_role;
grant execute on function private.max_dimension_ft(text) to authenticated, service_role;
grant execute on function private.loom_standard_days(text, text, int) to authenticated, service_role;
grant execute on function private.stage_standard_days(text, text, text, numeric, int, text) to authenticated, service_role;
grant execute on function private.orders_on_time_status(date, date, boolean, numeric) to authenticated, service_role;

alter function private.max_dimension_ft(text) set search_path = private, pg_temp;
alter function private.loom_standard_days(text, text, int) set search_path = private, pg_temp;
alter function private.stage_standard_days(text, text, text, numeric, int, text) set search_path = private, pg_temp;
alter function private.orders_on_time_status(date, date, boolean, numeric) set search_path = private, pg_temp;
