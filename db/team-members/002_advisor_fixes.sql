-- Follow-up migration addressing Supabase advisor findings from 001_team_members_schema.sql
-- (AGENTS.md Section 3.1 step 5 — "treat that check as a required step, not a cleanup
-- afterthought"). See MIGRATIONS.md for the full advisor run this responds to.

-- SECURITY (ERROR): employee_hierarchy_view was created without `security_invoker`, so by
-- default it runs as the view owner and bypasses the querying user's RLS on `employees`
-- entirely — anyone could see every employee's full manager chain. Fix: make it respect
-- the caller's own RLS.
alter view employee_hierarchy_view set (security_invoker = true);

-- SECURITY (WARN): current_employee_id, fn_is_in_manager_chain, employee_has_permission,
-- and employee_has_app_access are internal RLS helpers, not public API — but every
-- function in `public` is auto-exposed by PostgREST as a callable RPC endpoint
-- (`/rest/v1/rpc/<fn>`), letting any authenticated (or anon) caller pass arbitrary IDs
-- directly and probe permissions/management-chain relationships with no RLS gating at all.
-- Fix: move them to a schema PostgREST doesn't expose. Existing RLS policies keep working
-- unchanged — Postgres binds policy expressions to the function's OID at CREATE POLICY
-- time, not by re-resolving the name/schema on every query, so moving schema doesn't
-- require touching any policy.
create schema if not exists private;
grant usage on schema private to authenticated;

alter function current_employee_id() set schema private;
alter function fn_is_in_manager_chain(uuid, uuid) set schema private;
alter function employee_has_permission(uuid, text, uuid) set schema private;
alter function employee_has_app_access(uuid, text, app_access_level) set schema private;

-- PERFORMANCE (WARN): auth_rls_initplan — employees_select called `auth.uid()` directly
-- in the policy qual, which re-evaluates it per row instead of once per statement.
-- Wrapping in `(select auth.uid())` forces an InitPlan.
drop policy employees_select on employees;
create policy employees_select on employees for select to authenticated
  using (
    auth_user_id = (select auth.uid())
    or private.fn_is_in_manager_chain(private.current_employee_id(), id)
    or private.fn_is_in_manager_chain(id, private.current_employee_id())
    or department_id = (select department_id from employees where auth_user_id = (select auth.uid()))
    or private.employee_has_permission(private.current_employee_id(), 'employees.read.all')
  );

-- PERFORMANCE (WARN): multiple_permissive_policies — every reference table had both a
-- `_select_all`/`_select` policy AND a `_write` policy declared `for all` (which also
-- covers SELECT), so Postgres evaluated two permissive policies per read. The `_write`
-- policies were only ever meant to gate insert/update/delete; narrowing them removes the
-- overlap without changing behavior.
drop policy departments_write on departments;
create policy departments_write on departments for insert to authenticated with check (private.employee_has_permission(private.current_employee_id(), 'departments.manage'));
create policy departments_update on departments for update to authenticated using (private.employee_has_permission(private.current_employee_id(), 'departments.manage')) with check (private.employee_has_permission(private.current_employee_id(), 'departments.manage'));
create policy departments_delete on departments for delete to authenticated using (private.employee_has_permission(private.current_employee_id(), 'departments.manage'));

drop policy roles_write on roles;
create policy roles_write on roles for insert to authenticated with check (private.employee_has_permission(private.current_employee_id(), 'roles.manage'));
create policy roles_update on roles for update to authenticated using (private.employee_has_permission(private.current_employee_id(), 'roles.manage')) with check (private.employee_has_permission(private.current_employee_id(), 'roles.manage'));
create policy roles_delete on roles for delete to authenticated using (private.employee_has_permission(private.current_employee_id(), 'roles.manage'));

drop policy apps_write on apps;
create policy apps_write on apps for insert to authenticated with check (private.employee_has_permission(private.current_employee_id(), 'apps.manage'));
create policy apps_update on apps for update to authenticated using (private.employee_has_permission(private.current_employee_id(), 'apps.manage')) with check (private.employee_has_permission(private.current_employee_id(), 'apps.manage'));
create policy apps_delete on apps for delete to authenticated using (private.employee_has_permission(private.current_employee_id(), 'apps.manage'));

drop policy permissions_write on permissions;
create policy permissions_write on permissions for insert to authenticated with check (private.employee_has_permission(private.current_employee_id(), 'roles.manage'));
create policy permissions_update on permissions for update to authenticated using (private.employee_has_permission(private.current_employee_id(), 'roles.manage')) with check (private.employee_has_permission(private.current_employee_id(), 'roles.manage'));
create policy permissions_delete on permissions for delete to authenticated using (private.employee_has_permission(private.current_employee_id(), 'roles.manage'));

drop policy role_app_access_write on role_app_access;
create policy role_app_access_write on role_app_access for insert to authenticated with check (private.employee_has_permission(private.current_employee_id(), 'roles.manage'));
create policy role_app_access_update on role_app_access for update to authenticated using (private.employee_has_permission(private.current_employee_id(), 'roles.manage')) with check (private.employee_has_permission(private.current_employee_id(), 'roles.manage'));
create policy role_app_access_delete on role_app_access for delete to authenticated using (private.employee_has_permission(private.current_employee_id(), 'roles.manage'));

drop policy role_permissions_write on role_permissions;
create policy role_permissions_write on role_permissions for insert to authenticated with check (private.employee_has_permission(private.current_employee_id(), 'roles.manage'));
create policy role_permissions_update on role_permissions for update to authenticated using (private.employee_has_permission(private.current_employee_id(), 'roles.manage')) with check (private.employee_has_permission(private.current_employee_id(), 'roles.manage'));
create policy role_permissions_delete on role_permissions for delete to authenticated using (private.employee_has_permission(private.current_employee_id(), 'roles.manage'));

drop policy employees_write on employees;
create policy employees_write on employees for insert to authenticated with check (private.employee_has_permission(private.current_employee_id(), 'employees.write'));
create policy employees_update on employees for update to authenticated using (private.employee_has_permission(private.current_employee_id(), 'employees.write')) with check (private.employee_has_permission(private.current_employee_id(), 'employees.write'));
create policy employees_delete on employees for delete to authenticated using (private.employee_has_permission(private.current_employee_id(), 'employees.write'));

drop policy employee_roles_write on employee_roles;
create policy employee_roles_write on employee_roles for insert to authenticated with check (private.employee_has_permission(private.current_employee_id(), 'roles.manage', department_id));
create policy employee_roles_update on employee_roles for update to authenticated using (private.employee_has_permission(private.current_employee_id(), 'roles.manage', department_id)) with check (private.employee_has_permission(private.current_employee_id(), 'roles.manage', department_id));
create policy employee_roles_delete on employee_roles for delete to authenticated using (private.employee_has_permission(private.current_employee_id(), 'roles.manage', department_id));

drop policy department_access_grants_write on department_access_grants;
create policy department_access_grants_write on department_access_grants for insert to authenticated with check (private.employee_has_permission(private.current_employee_id(), 'departments.manage'));
create policy department_access_grants_update on department_access_grants for update to authenticated using (private.employee_has_permission(private.current_employee_id(), 'departments.manage')) with check (private.employee_has_permission(private.current_employee_id(), 'departments.manage'));
create policy department_access_grants_delete on department_access_grants for delete to authenticated using (private.employee_has_permission(private.current_employee_id(), 'departments.manage'));

-- Also update the two remaining select policies that referenced the helpers by their old
-- (now-moved) schema location.
drop policy employee_roles_select on employee_roles;
create policy employee_roles_select on employee_roles for select to authenticated
  using (
    employee_id = private.current_employee_id()
    or private.fn_is_in_manager_chain(private.current_employee_id(), employee_id)
    or private.employee_has_permission(private.current_employee_id(), 'roles.manage', department_id)
  );

drop policy department_access_grants_select on department_access_grants;
create policy department_access_grants_select on department_access_grants for select to authenticated
  using (
    employee_id = private.current_employee_id()
    or granted_by = private.current_employee_id()
    or private.employee_has_permission(private.current_employee_id(), 'departments.manage')
  );

-- PERFORMANCE (INFO): unindexed foreign key on department_access_grants.granted_by.
create index department_access_grants_granted_by_idx on department_access_grants(granted_by);
