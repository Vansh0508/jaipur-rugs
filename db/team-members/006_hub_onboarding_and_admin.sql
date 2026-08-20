-- Hub module (apps/hub): self-service employee sign-up/sign-in, multi-step onboarding,
-- profile, and a Team page for role/manager admin. See AGENTS.md Section 2 — this is the
-- "common interface" app the schema in 001_team_members_schema.sql was designed for
-- ("nullable: unset until an invited employee completes Auth signup") but nothing built on
-- until now. Decided with the user 2026-08-19: open signup (any email may sign up; an
-- existing `invited` row with a matching email is claimed instead of creating a duplicate).

-- Onboarding-complete flag ---------------------------------------------------
-- Single source of truth for "don't show onboarding again." Set once, by the
-- update-own-profile edge function, at the end of the wizard's last step.
alter table employees add column onboarding_completed_at timestamptz;

-- Employee code generator -----------------------------------------------------
-- Mirrors next_driver_code() in db/journeys/007_driver_code_helper.sql exactly, and for
-- the same reason: supabase-js/PostgREST has no first-class way to read a bare nextval()
-- from a service-role client, so it's wrapped in a tiny public RPC, service_role-only.
create sequence employee_code_seq;

create function public.next_employee_code()
returns text
language sql
as $$
  select 'EMP-' || lpad(nextval('employee_code_seq')::text, 3, '0');
$$;

revoke all on function public.next_employee_code() from public;
grant execute on function public.next_employee_code() to service_role;

-- Avatar storage bucket --------------------------------------------------------
-- Deliberate override of AGENTS.md's default "self-hosted S3, not Supabase Storage"
-- object storage choice, confirmed with the user 2026-08-19 — same pattern and same
-- rationale as db/feedback/005_create_driver_photos_bucket.sql's driver-photos bucket.
-- Public bucket: reads bypass RLS entirely (anyone with the object URL can view it, same
-- exposure level as a driver photo). No storage.objects write policy is added, so by
-- Storage's own default (no policy = no client writes), only the service role can upload
-- — that's the upload-employee-avatar edge function, never a direct client write.
insert into storage.buckets (id, name, public) values ('employee-avatars', 'employee-avatars', true);

-- Seed the Admin role -----------------------------------------------------------
-- 001_team_members_schema.sql deliberately seeded zero roles/role_permissions ("which
-- roles get which permissions is an Admin Team decision, not one to invent here"). The
-- user made that decision in this conversation: one global Admin role, bound to every
-- existing permission, granted to the one pre-existing active employee
-- (vansh.g@pixxeldigital.com / PIX-001 — already has a working, confirmed auth.users
-- account from Internal Portal testing, see MIGRATIONS.md's "Demo admin user" entry) so
-- there's someone who can use the Team page to invite everyone else.
do $$
declare
  admin_role_id uuid;
begin
  insert into roles (name, description, is_global)
  values ('Admin', 'Full org administration: employees, roles, departments, apps', true)
  returning id into admin_role_id;

  insert into role_permissions (role_id, permission_id)
  select admin_role_id, id from permissions
  where key in ('employees.read.all', 'employees.write', 'departments.manage', 'roles.manage', 'apps.manage');

  -- onboarding_completed_at = now(): this account's profile (phone, department,
  -- employment_type) is already populated from the Internal Portal seed — it shouldn't
  -- be forced through the Hub's onboarding wizard on first login.
  update employees
  set primary_role_id = admin_role_id, onboarding_completed_at = now()
  where email = 'vansh.g@pixxeldigital.com';
end $$;
