-- Fixes a pre-existing bug in employees_select (introduced in 002_advisor_fixes.sql,
-- never caught because no app queried `employees` under a real authenticated session
-- until apps/admin/internal-portal's proxy.ts/requireInternalPortalAccess did — the first
-- real exercise of this policy's "same department" branch).
--
-- The policy's "same department" branch was a raw subquery directly against `employees`:
--   department_id = (select department_id from employees where auth_user_id = auth.uid())
-- Unlike current_employee_id()/fn_is_in_manager_chain (SECURITY DEFINER functions, whose
-- internal employees lookups bypass RLS since they're owned by a BYPASSRLS role), this
-- subquery sits directly in the policy body, so Postgres evaluates it under the SAME RLS
-- context it's already computing — i.e. re-applying employees_select to itself, forever.
-- Confirmed live: any authenticated self-lookup against `employees` returned
-- `42P17: infinite recursion detected in policy for relation "employees"`, even though
-- the policy's first OR branch (auth_user_id = auth.uid()) would independently be true —
-- Postgres does not guarantee short-circuit evaluation of OR'd subqueries in a USING
-- clause, so a later recursive branch still blows up the whole policy.
--
-- Fix: same pattern as every other self-lookup in this file — wrap it in a SECURITY
-- DEFINER helper (bypasses RLS internally, breaking the recursion), exactly like
-- current_employee_id() already does for `id`.
create function private.current_employee_department_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select department_id from employees where auth_user_id = (select auth.uid());
$$;

drop policy employees_select on employees;
create policy employees_select on employees for select to authenticated
  using (
    auth_user_id = (select auth.uid())
    or private.fn_is_in_manager_chain(private.current_employee_id(), id)
    or private.fn_is_in_manager_chain(id, private.current_employee_id())
    or department_id = private.current_employee_department_id()
    or private.employee_has_permission(private.current_employee_id(), 'employees.read.all')
  );
