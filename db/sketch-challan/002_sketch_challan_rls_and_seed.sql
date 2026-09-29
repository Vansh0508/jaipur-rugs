-- Sketch Challan authorization, RLS and catalog seed.
-- WRITTEN 2026-09-23. REVISED 2026-09-28: three roles (no PDF uploader), Admin bound as an app role,
-- Hub primary roles honoured, the one-Sketching-Manager rule covers both role paths, RLS scoping fixed.
-- NOT APPLIED. Requires 001_sketch_challan_core.sql.

insert into apps (key, name, description)
values ('sketch-challan', 'Sketch Challan', 'Digital NAV sketch challan intake, delegation and permanent history')
on conflict (key) do update set name = excluded.name, description = excluded.description, updated_at = now();

-- Qualified column names: apps has its own `description`, which made the old unqualified select fail (42702).
insert into permissions (key, app_id, description)
select p.permission_key, a.id, p.description
from apps a
cross join (values
  ('sketch_challan.read.all', 'Read every sketch challan and task'),
  ('sketch_challan.refresh', 'Refresh challans from the NAV Excel inbox'),
  ('sketch_challan.edit', 'Edit challan details before allotment; request changes after'),
  ('sketch_challan.change.approve', 'Approve or reject allotted challan detail changes'),
  ('sketch_challan.tasks.manage', 'Allot parts (manager, before allotment); add parts and hand over (admin)'),
  ('sketch_challan.task.act', 'Start, submit and remark on a part the employee currently holds'),
  ('sketch_challan.due_date.manage', 'Change due dates and priorities'),
  ('sketch_challan.hold.manage', 'Hold and resume challans'),
  ('sketch_challan.complete.manage', 'Complete, reopen or cancel challans'),
  ('sketch_challan.export', 'Export and print challans')
) as p(permission_key, description)
where a.key = 'sketch-challan'
on conflict (key) do update set app_id = excluded.app_id, description = excluded.description;

do $$
declare v_role_id uuid;
begin
  select id into v_role_id from roles
    where name = 'Sketching Manager' and description = 'Sole operational manager for Sketcher delegation'
    order by id limit 1;
  if v_role_id is null then
    insert into roles (name, description, is_global)
      values ('Sketching Manager', 'Sole operational manager for Sketcher delegation', false)
      returning id into v_role_id;
  end if;
  insert into sketch_challan_role_bindings (role_key, role_id) values ('sketching_manager', v_role_id)
    on conflict (role_key) do update set role_id = excluded.role_id;

  select id into v_role_id from roles
    where name = 'Sketcher' and description = 'Works only on currently assigned Sketch Challan tasks'
    order by id limit 1;
  if v_role_id is null then
    insert into roles (name, description, is_global)
      values ('Sketcher', 'Works only on currently assigned Sketch Challan tasks', false)
      returning id into v_role_id;
  end if;
  insert into sketch_challan_role_bindings (role_key, role_id) values ('sketcher', v_role_id)
    on conflict (role_key) do update set role_id = excluded.role_id;

  -- The Hub's existing Admin role approves changes, hands tasks over and adds parts. Bound, not created:
  -- if the Hub has no role called Admin yet, bind one by hand before go-live.
  select id into v_role_id from roles where name = 'Admin' order by id limit 1;
  if v_role_id is null then
    raise notice 'No Hub role named Admin: insert a sketch_challan_role_bindings row with role_key admin before go-live.';
  else
    insert into sketch_challan_role_bindings (role_key, role_id) values ('admin', v_role_id)
      on conflict (role_key) do update set role_id = excluded.role_id;
  end if;
end;
$$;

insert into role_app_access (role_id, app_id, access_level)
select b.role_id, a.id,
  case when b.role_key = 'sketcher' then 'view'::app_access_level else 'manage'::app_access_level end
from sketch_challan_role_bindings b cross join apps a
where a.key = 'sketch-challan'
on conflict (role_id, app_id) do update set access_level = excluded.access_level, updated_at = now();

-- The manager is also a sketcher on the roster, so the Sketching Manager gets task.act for parts he takes himself.
insert into role_permissions (role_id, permission_id)
select b.role_id, p.id
from sketch_challan_role_bindings b
join permissions p on p.key = any(case b.role_key
  when 'sketching_manager' then array[
    'sketch_challan.read.all', 'sketch_challan.refresh', 'sketch_challan.edit', 'sketch_challan.tasks.manage',
    'sketch_challan.task.act', 'sketch_challan.due_date.manage', 'sketch_challan.hold.manage',
    'sketch_challan.complete.manage', 'sketch_challan.export'
  ]
  when 'admin' then array[
    'sketch_challan.read.all', 'sketch_challan.change.approve', 'sketch_challan.tasks.manage', 'sketch_challan.export'
  ]
  else array['sketch_challan.task.act', 'sketch_challan.export']
end)
on conflict (role_id, permission_id) do nothing;

-- True when the employee holds the app role through the Hub primary role or a current employee_roles row.
create function private.sketch_challan_has_role(p_employee_id uuid, p_role_key text)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from sketch_challan_role_bindings b
    where b.role_key = p_role_key and (
      exists (select 1 from employees e where e.id = p_employee_id and e.primary_role_id = b.role_id)
      or exists (
        select 1 from employee_roles er
        where er.employee_id = p_employee_id and er.role_id = b.role_id
          and current_date between er.valid_from and coalesce(er.valid_to, 'infinity'::date)
      )
    )
  );
$$;

create function private.can_read_sketch_challan(target_challan_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select private.employee_has_permission(private.current_employee_id(), 'sketch_challan.read.all')
    or exists (
      select 1 from sketch_challan_tasks t
      where t.challan_id = target_challan_id
        and t.current_sketcher_id = private.current_employee_id()
    )
    or exists (
      select 1 from sketch_challan_tasks t
      join sketch_challan_task_assignments a on a.task_id = t.id
      where t.challan_id = target_challan_id and a.sketcher_id = private.current_employee_id()
    );
$$;

create function private.is_current_sketch_challan_task_assignee(target_task_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from sketch_challan_tasks t
    where t.id = target_task_id and t.current_sketcher_id = private.current_employee_id()
  );
$$;

-- Exactly one Sketching Manager, counting both role paths and assignments not yet started (a future-dated second
-- manager used to slip through). Deferred, so a hand-over from one manager to the next can happen in one transaction.
create function private.enforce_one_sketching_manager()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_role_id uuid; v_count integer;
begin
  select role_id into v_role_id from sketch_challan_role_bindings where role_key = 'sketching_manager';
  if v_role_id is null then return null; end if;
  select count(distinct holder) into v_count from (
    select e.id as holder from employees e where e.primary_role_id = v_role_id and e.status = 'active'
    union
    select er.employee_id from employee_roles er
      where er.role_id = v_role_id and coalesce(er.valid_to, 'infinity'::date) >= current_date
  ) holders;
  if v_count > 1 then
    raise exception 'only one Sketching Manager is allowed (% hold the role)', v_count;
  end if;
  return null;
end;
$$;

create constraint trigger sketch_challan_one_manager_via_roles
after insert or update on employee_roles deferrable initially deferred
for each row execute function private.enforce_one_sketching_manager();

create constraint trigger sketch_challan_one_manager_via_primary_role
after insert or update of primary_role_id, status on employees deferrable initially deferred
for each row execute function private.enforce_one_sketching_manager();

create function private.enforce_sketcher_permission_ceiling()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_role_key text; v_permission_key text;
begin
  select b.role_key into v_role_key from sketch_challan_role_bindings b where b.role_id = new.role_id;
  select key into v_permission_key from permissions where id = new.permission_id;
  if v_role_key = 'sketcher' and v_permission_key like 'sketch_challan.%'
     and v_permission_key not in ('sketch_challan.task.act', 'sketch_challan.export') then
    raise exception 'permission % exceeds the Sketcher role ceiling', v_permission_key;
  end if;
  return new;
end;
$$;

create trigger sketcher_permission_ceiling before insert or update on role_permissions
for each row execute function private.enforce_sketcher_permission_ceiling();

-- RLS itself is enabled in 001. Read policies only; there are no write policies (writes go through 003).
create policy sketch_challans_select on sketch_challans for select to authenticated
using (private.can_read_sketch_challan(id));

create policy sketch_challan_role_bindings_select on sketch_challan_role_bindings for select to authenticated
using (true);

create policy sketch_challan_items_select on sketch_challan_items for select to authenticated
using (private.can_read_sketch_challan(challan_id));

-- Fully qualified: an unqualified `id` inside the subquery meant a.id, so former assignees never matched.
create policy sketch_challan_tasks_select on sketch_challan_tasks for select to authenticated
using (
  private.employee_has_permission(private.current_employee_id(), 'sketch_challan.read.all')
  or sketch_challan_tasks.current_sketcher_id = private.current_employee_id()
  or exists (select 1 from sketch_challan_task_assignments a
    where a.task_id = sketch_challan_tasks.id and a.sketcher_id = private.current_employee_id())
);

create policy sketch_challan_task_assignments_select on sketch_challan_task_assignments for select to authenticated
using (
  private.employee_has_permission(private.current_employee_id(), 'sketch_challan.read.all')
  or sketcher_id = private.current_employee_id()
);

create policy sketch_challan_change_requests_select on sketch_challan_change_requests for select to authenticated
using (private.employee_has_permission(private.current_employee_id(), 'sketch_challan.read.all'));

create policy sketch_challan_versions_select on sketch_challan_versions for select to authenticated
using (private.employee_has_permission(private.current_employee_id(), 'sketch_challan.read.all'));

create policy sketch_challan_activity_select on sketch_challan_activity for select to authenticated
using (
  private.employee_has_permission(private.current_employee_id(), 'sketch_challan.read.all')
  or (task_id is not null and private.is_current_sketch_challan_task_assignee(task_id))
);

create policy sketch_challan_notifications_select on sketch_challan_notifications for select to authenticated
using (recipient_employee_id = private.current_employee_id());
