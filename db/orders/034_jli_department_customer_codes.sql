-- Orders module. Adds department-level customer-code grants: a department can hold a
-- pre-set list of ERP customer codes that automatically apply to every employee holding
-- a department_access_grants row for it, instead of each person self-adding their own
-- codes one at a time (Back Ops' model, 017). Built for Jaipur Living (033_jli_department.sql,
-- applied moments earlier as "032_jli_department" in Supabase's migration history -- filed
-- under 033 here after a numbering collision with a concurrent in-flight migration,
-- 032_orders_filtered_summary_rpc.sql, from a different session editing this same repo at
-- the same time) per Ayaan's explicit direction, 2026-09-17: "when someone selects the
-- Jaipur Living dept, the pre added sales or customer codes will be there" -- i.e.
-- membership grants the codes live via a join, not a one-time copy into
-- employee_salesperson_codes/merchant_customer_codes, so adding or removing a code from
-- the department immediately changes what its current members can see.
--
-- Codes for Jaipur Living, per the 2026-09-17 JLI dashboard meeting transcript and
-- confirmed both against the live `orders` table and the raw NAV-002 Rug List Main.xlsx
-- export Ayaan shared directly: 1081 (737 orders live), 108000 (64), 0180 (95), 0108
-- (3,391), 0322 (2,922).
--
-- 0108 and 0322 are also in STOCK_CUSTOMER_CODES (apps/atlas/lib/queries/orders.ts) --
-- excluded from every normal Atlas view by default since 2026-09-03 (a deliberate,
-- separate decision: those codes were polluting Dashboard stats org-wide). Ayaan
-- confirmed 2026-09-17: keep that exclusion for everyone else, but let Jaipur Living see
-- them. This migration only does the DB-level grant (RLS now allows it); it deliberately
-- does NOT touch apps/atlas/lib/queries/orders.ts's STOCK_CUSTOMER_CODES filter -- that
-- file has active uncommitted changes from a concurrent session (an Orders Summary Panel
-- feature, same day) and editing it blind risks clobbering that work. Whoever picks this
-- up next needs to make listOrders/listOrderFacets/orders_filtered_summary stop excluding
-- 0108/0322 specifically for employees who resolve access via department_customer_codes
-- (or hold a direct merchant_customer_codes row for those codes) -- see this file's
-- companion note in db/MIGRATIONS.md.

create table department_customer_codes (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references departments(id) on delete cascade,
  customer_no text not null,
  created_at timestamptz not null default now()
);

create unique index department_customer_codes_department_customer_idx
  on department_customer_codes(department_id, customer_no);

alter table department_customer_codes enable row level security;

-- Same posture as departments_select_all: any authenticated employee can read the
-- registry (which codes belong to which department isn't sensitive), writes gated by
-- departments.manage same as the departments table itself.
create policy department_customer_codes_select on department_customer_codes for select to authenticated using (true);
create policy department_customer_codes_write on department_customer_codes for all to authenticated
  using (private.employee_has_permission(private.current_employee_id(), 'departments.manage'))
  with check (private.employee_has_permission(private.current_employee_id(), 'departments.manage'));

insert into department_customer_codes (department_id, customer_no)
select departments.id, customer_code
from departments, unnest(array['1081', '108000', '0180', '0108', '0322']) as customer_code
where departments.code = 'jli'
on conflict (department_id, customer_no) do nothing;

-- orders_select (009's hoisted shape): add a branch for "employee belongs to a
-- department that's been granted this order's customer code" -- additive, changes
-- nothing for anyone without a department_access_grants row pointing at a department
-- that has rows in department_customer_codes.
drop policy orders_select on orders;
create policy orders_select on orders for select to authenticated
  using (
    (select private.has_blanket_orders_access(private.current_employee_id()))
    or exists (
      select 1
      from employee_salesperson_codes esc
      where esc.employee_id = (select private.current_employee_id())
        and esc.salesperson_code = orders.salesperson_code
    )
    or exists (
      select 1
      from merchant_customer_codes mcc
      where mcc.employee_id = (select private.current_employee_id())
        and mcc.customer_no = orders.customer_no
    )
    or exists (
      select 1
      from department_access_grants dag
      join department_customer_codes dcc on dcc.department_id = dag.department_id
      where dag.employee_id = (select private.current_employee_id())
        and dcc.customer_no = orders.customer_no
    )
  );

-- can_view_order(): same addition, so the per-order timeline/shipping panel
-- (order_stage_events, shipping_details) is visible to a department-code-granted
-- employee too, not just the orders row itself. Existing branches (including 030's
-- broader "stock is visible to anyone with any real access" clause) kept as-is.
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
        or exists (
          select 1
          from department_access_grants dag
          join department_customer_codes dcc on dcc.department_id = dag.department_id
          where dag.employee_id = private.current_employee_id()
            and dcc.customer_no = o.customer_no
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
