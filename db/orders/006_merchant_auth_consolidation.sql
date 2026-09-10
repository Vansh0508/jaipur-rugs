-- Orders module, file 6. Consolidate merchant auth onto Supabase Auth. "Merchants" are
-- actually internal Jaipur Rugs salespeople/territory heads (B2B team), not external
-- customers, per Ayaan's correction 2026-09-01 — the original Clerk-vs-Supabase split
-- (001_orders_core_schema.sql, 002_orders_rls.sql, 005_advisor_fixes.sql) was built on
-- the opposite (incorrect) assumption. From now on a "merchant" is just an employee
-- row; merchant_customer_codes scopes an EMPLOYEE to the ERP customer codes they're
-- allowed to see (the "many codes, one person" shape a territory head needs — one
-- salesperson_code alone doesn't cover a whole territory the way orders.salesperson_code
-- matching already does for a single-code sales rep).
--
-- APPLIED 2026-09-01 to matnispbauvvlnbsuzxq, advisor-clean. Real trigger: setting up
-- Dinesh Choudhary (dinesh.c@jaipurrugs.com, 72 customer codes) surfaced that the
-- Clerk-based merchant login was broken in two independent ways (CLERK_SECRET_KEY never
-- set as an Edge Function secret; Clerk never configured as a Supabase Third-Party Auth
-- provider either) — both gaps this consolidation removes entirely rather than fixes.

alter table merchant_customer_codes add column employee_id uuid references employees(id) on delete cascade;

-- Backfill from the old Clerk-based merchants table for anyone with a matching
-- employees row already (by email). Rows that can't backfill (no matching employees
-- row yet — that salesperson hasn't signed up via the normal employee-signup flow)
-- keep employee_id null; the new can_view_order() below only matches rows where it's
-- set, so this fails closed rather than granting nobody's data to everybody. Left
-- nullable (not enforced NOT NULL) for the same reason escalation_levels.notify_employee_id
-- stays null until a real account exists — link it once the person actually signs up.
update merchant_customer_codes mcc
set employee_id = e.id
from merchants m
join employees e on lower(e.email) = lower(m.primary_contact_email)
where mcc.merchant_id = m.id;

-- Drop the OLD policy first — it references merchant_id, which must go before the column does.
drop policy if exists merchant_customer_codes_select on merchant_customer_codes;

alter table merchant_customer_codes drop constraint merchant_customer_codes_merchant_id_fkey;
alter table merchant_customer_codes drop column merchant_id;
create unique index merchant_customer_codes_employee_customer_idx on merchant_customer_codes(employee_id, customer_no) where employee_id is not null;
create index merchant_customer_codes_employee_id_idx on merchant_customer_codes(employee_id);

drop table merchants cascade;

-- can_view_order(): merchant branch now matches the CALLER'S OWN employee id (Supabase
-- Auth, same primitive as every other branch here) against merchant_customer_codes,
-- instead of a Clerk JWT's `sub` claim. No Clerk dependency left in the database at all.
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
        or (
          private.current_employee_salesperson_code() is not null
          and o.salesperson_code = private.current_employee_salesperson_code()
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

-- merchant_customer_codes RLS: "can see your own rows" (admin, or your own employee_id)
-- — no more Clerk JWT matching.
create policy merchant_customer_codes_select on merchant_customer_codes for select to authenticated
  using (
    private.employee_has_permission(private.current_employee_id(), 'orders.read.all')
    or employee_id = private.current_employee_id()
  );
