-- Orders module, file 30. RugLens access widened to every Atlas user -- direct
-- instruction from Ayaan, 2026-09-16 ("give access for rug lens to everyone"), after
-- investigating why RugLens felt inaccessible.
--
-- Two separate problems were found and are being fixed together here (the app-level
-- half is a plain code change, committed alongside this migration -- see
-- apps/atlas/lib/auth/requireRugLensAccess.ts):
--
-- 1. App-level gate (fixed in code, not here): requireRugLensAccess() originally only
--    checked department_access_grants for sales/backops. Checked live before this
--    migration: 0 employees held an actual "sales" department_access_grants row --
--    that was never how real salespeople get into Atlas. Now simplified to grant
--    RugLens to anyone who already has general Atlas staff access at all (the same
--    "any real reason to be here" check every other Atlas page already uses).
--
-- 2. Row-level security (fixed here): even with (1) fixed, a real salesperson/merchant-
--    code holder passing the app-level check would still see an EMPTY RugLens table,
--    silently. private.can_view_order() only grants a salesperson/merchant-code holder
--    visibility into rows matching THEIR OWN salesperson_code/customer_no -- correct
--    for real customer orders, but confirmed live this doesn't work for RugLens's
--    stock/sample rows: of 32,728 rows under the 5 STOCK_CUSTOMER_CODES, only 3,081
--    have any salesperson_code at all, spanning just 3 distinct codes. Stock/sample
--    inventory isn't "assigned" to a specific salesperson or customer the way a real
--    order is, so it needs its own broader visibility rule, not per-row scoping.
--
-- Fix: one new OR-branch on can_view_order(), scoped ONLY to stock rows (customer_no in
-- the 5 STOCK_CUSTOMER_CODES -- same literal list already duplicated in
-- 018_perf_facets_and_stats_rpcs.sql and apps/atlas/lib/queries/orders.ts's exported
-- constant, kept in sync manually, same caveat that migration's own comment already
-- notes) -- deliberately does NOT touch visibility for real customer orders, which stay
-- exactly as scoped today (a salesperson still only sees their own real orders). Grants
-- stock-row visibility to anyone holding ANY department grant Atlas recognizes
-- (production/shipping/sales/management/backops), any self-service salesperson code, or
-- any merchant customer code -- i.e. anyone who's already a real Atlas user by any of
-- the existing "reason to be here" tests, matching "give it to everyone" without
-- widening what a salesperson can see for real customer orders.
create or replace function private.can_view_order(target_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select exists (
    select 1
    from orders o
    where o.id = target_order_id
      and (
        private.employee_has_permission(private.current_employee_id(), 'orders.read.all')
        or private.has_atlas_department_access(private.current_employee_id(), 'production')
        or private.has_atlas_department_access(private.current_employee_id(), 'shipping')
        or private.has_atlas_department_access(private.current_employee_id(), 'sales')
        or private.has_atlas_department_access(private.current_employee_id(), 'management')
        or exists (
          select 1
          from employee_salesperson_codes esc
          where esc.employee_id = private.current_employee_id()
            and esc.salesperson_code = o.salesperson_code
        )
        or exists (
          select 1
          from merchant_customer_codes mcc
          where mcc.employee_id = private.current_employee_id()
            and mcc.customer_no = o.customer_no
        )
        or (
          o.customer_no in ('0277', '0177', '0877', '0322', '0108')
          and (
            private.has_atlas_department_access(private.current_employee_id(), 'production')
            or private.has_atlas_department_access(private.current_employee_id(), 'shipping')
            or private.has_atlas_department_access(private.current_employee_id(), 'sales')
            or private.has_atlas_department_access(private.current_employee_id(), 'management')
            or private.has_atlas_department_access(private.current_employee_id(), 'backops')
            or exists (
              select 1 from employee_salesperson_codes esc where esc.employee_id = private.current_employee_id()
            )
            or exists (
              select 1 from merchant_customer_codes mcc where mcc.employee_id = private.current_employee_id()
            )
          )
        )
      )
  );
$$;
