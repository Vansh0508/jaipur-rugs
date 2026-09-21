-- Orders module. Registers "Jaipur Living" (JLI) as a real department, requested directly
-- 2026-09-17 following a JLI team meeting about a dashboard for JLI order/sample tracking
-- (customer code 1081, zone "JLI", etc. -- see 2026-09-17_JLI_Dashboard_Meeting_Transcript.md
-- in Ayaan's Rug Tracker working folder, not this repo).
--
-- Deliberately NOT added to private.has_blanket_orders_access() or
-- private.can_view_order()'s blanket department list -- same posture as Back Ops (017):
-- the explicit ask was to scope this department to specific codes only, not hand its
-- members visibility into every order.
--
-- Two things are intentionally NOT done in this migration, both still open:
-- 1. Which codes actually belong to JLI is unconfirmed -- customer code 1081 is the only
--    one of the codes discussed in the meeting that exists in live Atlas data today; the
--    others mentioned (108, 108000, 180/1800, 322) don't match anything in this schema and
--    may be raw ERP concepts nobody's mapped in yet. Not guessing at that mapping here.
-- 2. The desired membership model is NOT Back Ops' "each person self-adds their own code
--    via salesperson-codes-add/customer-codes-add" -- the ask this time is that selecting
--    "Jaipur Living" at join time should surface a pre-set list of codes automatically,
--    department-wide. That needs its own schema (a department-level code table the RLS
--    functions also check, not a one-time copy into employee_salesperson_codes/
--    merchant_customer_codes at join time, so future changes to the department's code
--    list keep applying to existing members) -- a deliberate follow-up migration once the
--    code list above is confirmed, not built here.
--
-- Also not added to join-department's SELF_SERVICE_DEPARTMENT_CODES yet, for the same
-- reason -- self-service join only makes sense once it's decided what joining actually
-- grants.

insert into departments (name, code) values ('Jaipur Living', 'jli')
on conflict (code) do nothing;
