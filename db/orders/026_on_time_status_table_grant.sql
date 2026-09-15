-- Second permission gap caught by actually re-running validate-on-time-status-port.mjs
-- after 025's function grants (which fixed the function-call side but not this) —
-- private.loom_standard_days() SELECTs directly from private.zero_priority_knotted_rate,
-- and same as the functions themselves, that's a plain table with no default grant to
-- anyone outside its owner. Postgres's own error even named the exact fix:
-- "permission denied for table zero_priority_knotted_rate ... GRANT SELECT ON
-- private.zero_priority_knotted_rate TO service_role". Granting to authenticated too,
-- matching 025's functions — real end users query orders_with_on_time_status as
-- `authenticated`, not service_role; the validation script itself happens to run as
-- service_role (needs to see every row, unfiltered by RLS), but that's not who the
-- live frontend will be.

grant select on private.zero_priority_knotted_rate to authenticated, service_role;
