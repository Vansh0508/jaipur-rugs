-- Orders module. Generalizes "which ERP salesperson_code(s) can this employee see
-- orders for" from a single nullable employees.salesperson_code column into a proper
-- one-to-many table -- the same shape merchant_customer_codes already uses for the
-- "one person, many codes" case (territory heads like Dinesh).
--
-- Built for self-service: there is no reliable way to derive a name<->code mapping
-- from the ERP feed (confirmed 2026-09-02 -- the codes don't even map cleanly to one
-- person each, some cover thousands of orders across several client accounts), so a
-- person typing in their own already-known code is the real answer. This is exactly
-- how the pre-Atlas tool at ai.jaipurrugs.com/track-jr-order/ already works: a
-- salesperson's login code IS their ERP salesperson code, not a derived identity.
--
-- Deliberately no approval step (explicit product decision, 2026-09-02) -- the
-- underlying order data isn't confidential between salespeople in the first place, so
-- a review queue wasn't worth the friction. The guardrail that DOES exist regardless:
-- the edge function this table is written through (salesperson-codes-add) only ever
-- inserts rows for the CALLER'S OWN employee_id, taken from their own session -- never
-- a client-supplied id -- so self-service can only ever widen your own access, never
-- anyone else's.
--
-- Checked live before writing this: 0 employees have employees.salesperson_code set,
-- so there's no data to migrate -- the column and private.current_employee_salesperson_code()
-- are superseded outright, not backfilled.

create table employee_salesperson_codes (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  salesperson_code text not null,
  created_at timestamptz not null default now()
);

create unique index employee_salesperson_codes_employee_code_idx on employee_salesperson_codes(employee_id, salesperson_code);
create index employee_salesperson_codes_code_idx on employee_salesperson_codes(salesperson_code);

alter table employee_salesperson_codes enable row level security;

-- Same visibility rule as merchant_customer_codes_select: admin sees everyone's rows,
-- an employee sees only their own. No client write policy — see salesperson-codes-add.
create policy employee_salesperson_codes_select on employee_salesperson_codes for select to authenticated
  using (
    (select private.employee_has_permission(private.current_employee_id(), 'orders.read.all'))
    or employee_id = (select private.current_employee_id())
  );

-- can_view_order(): swap the old single-column salesperson match for a lookup against
-- the new table — same shape as the merchant_customer_codes branch right below it.
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

-- orders_select (009's hoisted version): same swap, keeping the InitPlan-hoisted shape
-- 009 already established for the row-independent checks.
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
  );

-- employees.salesperson_code and its lookup helper are now fully superseded — dropped
-- rather than left as dead weight for a future reader to wonder about.
drop function private.current_employee_salesperson_code();
alter table employees drop column salesperson_code;
