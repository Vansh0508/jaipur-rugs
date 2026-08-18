-- Team Members / RBAC / Hierarchy module — see team-members-schema.mmd for the ERD.
-- Applied to project: matnispbauvvlnbsuzxq ("research-and-development-webapp"), confirmed
-- with the user 2026-08-17 after `eevzwnjjcedyuehpprgk` ("Jaipur Rugs Foundation") turned
-- out to already hold live, unrelated data (forms/submissions app) — see MIGRATIONS.md.
--
-- This is the first migration for this module — nothing here has a cross-module
-- dependency, so it can run standalone. `db/feedback/001_feedback_schema.sql` depends on
-- `departments` existing, so it must run AFTER this one.

-- Enums ---------------------------------------------------------------------

create type employee_status as enum ('invited', 'active', 'inactive', 'on_leave', 'offboarded');
create type employment_type as enum ('full_time', 'part_time', 'contract', 'intern', 'consultant');
-- Declared in ascending order on purpose: RLS predicates compare directly (e.g. `>= 'view'`).
create type access_level as enum ('view', 'manage', 'admin');
create type app_access_level as enum ('none', 'view', 'manage');

-- Tables ----------------------------------------------------------------------

create table departments (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  code text unique not null,
  parent_department_id uuid references departments(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table roles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  is_global boolean not null default false,
  created_at timestamptz not null default now()
);

create table employees (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id), -- nullable: unset until an invited employee completes Auth signup
  employee_code text unique not null,
  full_name text not null,
  email text unique not null,
  phone text,
  department_id uuid references departments(id),
  manager_id uuid references employees(id), -- self-referencing: sole hierarchy mechanism, no closure table
  primary_role_id uuid references roles(id),
  status employee_status not null default 'invited',
  employment_type employment_type not null default 'full_time',
  avatar_path text, -- S3 object key, not a full URL
  joined_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table employee_roles (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id),
  role_id uuid not null references roles(id),
  department_id uuid references departments(id), -- scopes this assignment
  valid_from date not null default current_date,
  valid_to date, -- nullable: open-ended
  created_at timestamptz not null default now()
);

create table department_access_grants (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id), -- grantee
  department_id uuid not null references departments(id),
  access_level access_level not null default 'view',
  granted_by uuid references employees(id),
  granted_at timestamptz not null default now()
);

create table apps (
  id uuid primary key default gen_random_uuid(),
  key text unique not null, -- matches apps/<key> folder name, e.g. "hub", "feedback-app"
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table permissions (
  id uuid primary key default gen_random_uuid(),
  key text unique not null, -- e.g. "employees.write", "roles.manage"
  app_id uuid references apps(id), -- nullable: null = global/cross-app permission
  description text,
  created_at timestamptz not null default now()
);

create table role_app_access (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references roles(id),
  app_id uuid not null references apps(id),
  access_level app_access_level not null default 'none', -- absent row = implicit 'none' too
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (role_id, app_id)
);

create table role_permissions (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references roles(id),
  permission_id uuid not null references permissions(id),
  created_at timestamptz not null default now(),
  unique (role_id, permission_id)
);

-- Indexes -----------------------------------------------------------------
-- Postgres doesn't auto-index FK columns (only the PK) — these are load-bearing for the
-- hierarchy walk and every permission check, which run on essentially every request.

create index departments_parent_department_id_idx on departments(parent_department_id);
create index employees_department_id_idx on employees(department_id);
create index employees_manager_id_idx on employees(manager_id);
create index employees_primary_role_id_idx on employees(primary_role_id);
create index employee_roles_employee_id_idx on employee_roles(employee_id);
create index employee_roles_role_id_idx on employee_roles(role_id);
create index employee_roles_department_id_idx on employee_roles(department_id);
create index employee_roles_current_idx on employee_roles(employee_id) where valid_to is null;
create index department_access_grants_employee_id_idx on department_access_grants(employee_id);
create index department_access_grants_department_id_idx on department_access_grants(department_id);
create index permissions_app_id_idx on permissions(app_id);
create index role_app_access_role_id_idx on role_app_access(role_id);
create index role_app_access_app_id_idx on role_app_access(app_id);
create index role_permissions_role_id_idx on role_permissions(role_id);
create index role_permissions_permission_id_idx on role_permissions(permission_id);

-- Helper functions ---------------------------------------------------------
-- SECURITY DEFINER + a pinned search_path on purpose: these are called from inside other
-- tables' RLS policies, and need to evaluate against the full employees/role_permissions
-- tables regardless of the calling user's own row-level visibility, or policy checks could
-- silently under-authorize. Narrow, single-purpose definer functions, not a blanket bypass.

create function current_employee_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select id from employees where auth_user_id = auth.uid();
$$;

create function fn_is_in_manager_chain(candidate_id uuid, target_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  current_id uuid := target_id;
  depth int := 0;
begin
  if candidate_id is null or target_id is null then
    return false;
  end if;

  while depth < 25 loop
    select manager_id into current_id from employees where id = current_id;
    if current_id is null then
      return false;
    end if;
    if current_id = candidate_id then
      return true;
    end if;
    depth := depth + 1;
  end loop;

  return false;
end;
$$;

create function employee_has_permission(emp_id uuid, perm_key text, dept_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from employees e
      join role_permissions rp on rp.role_id = e.primary_role_id
      join permissions p on p.id = rp.permission_id and p.key = perm_key
    where e.id = emp_id
    union
    select 1 from employee_roles er
      join role_permissions rp on rp.role_id = er.role_id
      join permissions p on p.id = rp.permission_id and p.key = perm_key
    where er.employee_id = emp_id
      and current_date between er.valid_from and coalesce(er.valid_to, 'infinity'::date)
      and (dept_id is null or er.department_id = dept_id)
  );
$$;

create function employee_has_app_access(emp_id uuid, app_key text, min_level app_access_level)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from employees e
      join role_app_access raa on raa.role_id = e.primary_role_id
      join apps a on a.id = raa.app_id and a.key = app_key
    where e.id = emp_id and raa.access_level >= min_level
    union
    select 1 from employee_roles er
      join role_app_access raa on raa.role_id = er.role_id
      join apps a on a.id = raa.app_id and a.key = app_key
    where er.employee_id = emp_id
      and current_date between er.valid_from and coalesce(er.valid_to, 'infinity'::date)
      and raa.access_level >= min_level
  );
$$;

-- Org-chart view (recursive) — for the Hub's UI only, never joined inside an RLS policy
-- (fn_is_in_manager_chain above is what policies call, since it stays bounded to one
-- employee's ancestor chain instead of materializing every chain in the table).
create view employee_hierarchy_view as
with recursive chain as (
  select id, manager_id, id as root_id, 0 as depth, array[id] as path
  from employees
  union all
  select e.id, e.manager_id, c.root_id, c.depth + 1, c.path || e.id
  from employees e
  join chain c on e.manager_id = c.id
)
select * from chain;

-- RLS -----------------------------------------------------------------------

alter table departments enable row level security;
alter table roles enable row level security;
alter table employees enable row level security;
alter table employee_roles enable row level security;
alter table department_access_grants enable row level security;
alter table apps enable row level security;
alter table permissions enable row level security;
alter table role_app_access enable row level security;
alter table role_permissions enable row level security;

-- Reference/registry tables: open SELECT to any authenticated employee, writes gated by
-- the relevant *.manage permission.
create policy departments_select_all on departments for select to authenticated using (true);
create policy departments_write on departments for all to authenticated
  using (employee_has_permission(current_employee_id(), 'departments.manage'))
  with check (employee_has_permission(current_employee_id(), 'departments.manage'));

create policy roles_select_all on roles for select to authenticated using (true);
create policy roles_write on roles for all to authenticated
  using (employee_has_permission(current_employee_id(), 'roles.manage'))
  with check (employee_has_permission(current_employee_id(), 'roles.manage'));

create policy apps_select_all on apps for select to authenticated using (true);
create policy apps_write on apps for all to authenticated
  using (employee_has_permission(current_employee_id(), 'apps.manage'))
  with check (employee_has_permission(current_employee_id(), 'apps.manage'));

create policy permissions_select_all on permissions for select to authenticated using (true);
create policy permissions_write on permissions for all to authenticated
  using (employee_has_permission(current_employee_id(), 'roles.manage'))
  with check (employee_has_permission(current_employee_id(), 'roles.manage'));

create policy role_app_access_select_all on role_app_access for select to authenticated using (true);
create policy role_app_access_write on role_app_access for all to authenticated
  using (employee_has_permission(current_employee_id(), 'roles.manage'))
  with check (employee_has_permission(current_employee_id(), 'roles.manage'));

create policy role_permissions_select_all on role_permissions for select to authenticated using (true);
create policy role_permissions_write on role_permissions for all to authenticated
  using (employee_has_permission(current_employee_id(), 'roles.manage'))
  with check (employee_has_permission(current_employee_id(), 'roles.manage'));

-- EMPLOYEES: self, manager-chain (either direction), same department (peer visibility),
-- or an org-wide read permission. Writes gated by employees.write — no self-service path
-- is defined yet (flagged as an open decision, not built: see the Phase 1 design notes).
create policy employees_select on employees for select to authenticated
  using (
    auth_user_id = auth.uid()
    or fn_is_in_manager_chain(current_employee_id(), id)
    or fn_is_in_manager_chain(id, current_employee_id())
    or department_id = (select department_id from employees where auth_user_id = auth.uid())
    or employee_has_permission(current_employee_id(), 'employees.read.all')
  );
create policy employees_write on employees for all to authenticated
  using (employee_has_permission(current_employee_id(), 'employees.write'))
  with check (employee_has_permission(current_employee_id(), 'employees.write'));

-- EMPLOYEE_ROLES / DEPARTMENT_ACCESS_GRANTS: self, manager-chain, or the relevant *.manage
-- permission, scoped by department where applicable.
create policy employee_roles_select on employee_roles for select to authenticated
  using (
    employee_id = current_employee_id()
    or fn_is_in_manager_chain(current_employee_id(), employee_id)
    or employee_has_permission(current_employee_id(), 'roles.manage', department_id)
  );
create policy employee_roles_write on employee_roles for all to authenticated
  using (employee_has_permission(current_employee_id(), 'roles.manage', department_id))
  with check (employee_has_permission(current_employee_id(), 'roles.manage', department_id));

create policy department_access_grants_select on department_access_grants for select to authenticated
  using (
    employee_id = current_employee_id()
    or granted_by = current_employee_id()
    or employee_has_permission(current_employee_id(), 'departments.manage')
  );
create policy department_access_grants_write on department_access_grants for all to authenticated
  using (employee_has_permission(current_employee_id(), 'departments.manage'))
  with check (employee_has_permission(current_employee_id(), 'departments.manage'));

-- Seed data -----------------------------------------------------------------
-- Baseline app registry + permission catalog only — no roles or role_permissions
-- bindings. Which roles get which permissions is an Admin Team decision, not one to
-- invent here.

insert into apps (key, name, description) values
  ('hub', 'Hub', 'Common interface: auth, org directory, hierarchy, role/access admin, launcher'),
  ('feedback-app', 'Driver Feedback', 'Employees and guests rate in-house drivers after a trip');

insert into permissions (key, description) values
  ('employees.read.all', 'Read any employee record, not just self/manager-chain/department'),
  ('employees.write', 'Create or update employee records'),
  ('departments.manage', 'Create/update departments and department access grants'),
  ('roles.manage', 'Create/update roles, role-app-access, and role-permission bindings'),
  ('apps.manage', 'Create/update the app registry');

insert into permissions (key, app_id, description)
  select 'drivers.manage', id, 'Create/update driver records'
  from apps where key = 'feedback-app';
