-- Orders module. Fixes a real, confirmed statement timeout on `/orders` in production
-- (2026-09-02) now that the table actually holds real data (14,214 rows from the first
-- successful ERP sync) instead of the near-empty table this was designed against.
--
-- Root cause: `orders_select`'s policy is `using (private.can_view_order(id))` — a
-- single opaque function call that PostgreSQL must invoke once per candidate row,
-- because it takes the row's own `id` as an argument. Inside that function, the
-- "coarse" checks (orders.read.all permission, production/shipping/sales department
-- access, the caller's own employee id) don't actually depend on the row at all — they
-- were only wrapped in a per-row function because can_view_order() is shared with
-- order_stage_events_select/shipping_details_select, which DO need a row-to-order
-- lookup. For the `orders` table's own policy this meant re-deriving "is this employee
-- an admin" from scratch (several joins) for every one of 14,214 rows, on every page
-- load, before Postgres could even apply the `limit 500` -- confirmed live via
-- pm2's error log: `{"code":"57014", ..., "message":"canceling statement due to
-- statement timeout"}` on a plain `/orders` visit.
--
-- Fix: give `orders_select` its own policy that reads the row's own salesperson_code/
-- customer_no columns directly (no redundant self-lookup back into `orders` at all) and
-- wraps every row-INDEPENDENT check in `(select ...)` — the exact shape
-- 005_advisor_fixes.sql already found necessary for `auth_rls_initplan` — so Postgres's
-- planner evaluates them once per query (an InitPlan) instead of once per row. For the
-- common case (an admin, or someone with a department grant), that single cached
-- true short-circuits the rest of the OR entirely; only a salesperson/merchant-code
-- caller falls through to the (now index-backed, per-row-cheap) column comparisons.
-- `can_view_order()` itself is untouched and still used by order_stage_events_select/
-- shipping_details_select, where the row-to-order lookup is unavoidable but the row
-- counts per query are small (one order's events/shipping detail, not the whole table).

create or replace function private.has_blanket_orders_access(emp_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    private.employee_has_permission(emp_id, 'orders.read.all')
    or private.has_atlas_department_access(emp_id, 'production')
    or private.has_atlas_department_access(emp_id, 'shipping')
    or private.has_atlas_department_access(emp_id, 'sales');
$$;

drop policy orders_select on orders;
create policy orders_select on orders for select to authenticated
  using (
    (select private.has_blanket_orders_access(private.current_employee_id()))
    or (
      (select private.current_employee_salesperson_code()) is not null
      and salesperson_code = (select private.current_employee_salesperson_code())
    )
    or exists (
      select 1
      from merchant_customer_codes mcc
      where mcc.employee_id = (select private.current_employee_id())
        and mcc.customer_no = orders.customer_no
    )
  );

-- The list view sorts by updated_at desc with a limit -- no index existed for that sort,
-- so a full sort of the whole table was needed on every page load even before RLS.
create index if not exists orders_updated_at_idx on orders(updated_at desc);
