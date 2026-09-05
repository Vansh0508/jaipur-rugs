-- Orders module. Adds a "Management" department (directors/managers) and lets anyone
-- self-declare into it or into Production at sign-up, same self-service posture as
-- employee_salesperson_codes (010) -- no approval step, confirmed as an explicit product
-- decision (2026-09-05): "Management, Production should [see] all orders same as admin
-- and not bind with any customer code."
--
-- Deliberately its OWN department, not a re-use of `admin` -- "Admin account is mine"
-- (2026-09-05): Management should see every order (blanket view), but should NOT pick
-- up whatever else the real `admin`/orders.read.all permission might unlock later
-- (e.g. the Merchants page). This grants visibility only, at access_level 'view' (the
-- lowest of view/manage/admin) -- nobody self-service-grants themselves 'manage' or
-- 'admin' on anything.
--
-- NAV/Order Processing, QC Review, and Shipping are deliberately NOT part of this
-- self-service set yet ("will come in later stage") -- only Management, Sales (already
-- self-service via 010, unchanged here), and Production are offered at sign-up for now.

insert into departments (name, code) values ('Management', 'management');

-- No unique constraint existed on (employee_id, department_id) — needed so the new
-- self-service join-department function can upsert idempotently (re-submitting the
-- same department is a no-op, not a duplicate row).
create unique index department_access_grants_employee_department_idx
  on department_access_grants(employee_id, department_id);

-- has_blanket_orders_access() (009) already OR's in the three department codes that
-- mean "see everything" -- Management joins that list. Production was already in it.
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
    or private.has_atlas_department_access(emp_id, 'sales')
    or private.has_atlas_department_access(emp_id, 'management');
$$;

-- can_view_order() (order_stage_events/shipping_details visibility) has its own
-- separate department-code list rather than calling has_blanket_orders_access() —
-- needs the same addition so an order's timeline/shipping panel is visible to
-- Management too, not just the orders row itself.
create or replace function private.can_view_order(target_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
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
      )
  );
$$;
