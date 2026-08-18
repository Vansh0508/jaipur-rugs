-- Demo/ops seed: ensures the two departments the Internal Portal auth gate and the
-- Journeys demo employee depend on exist. Idempotent (safe to re-run) — "ensure exists",
-- not "must not exist yet". `code` is the value private.is_internal_portal_admin() and
-- apps/admin/internal-portal's proxy.ts both match on; `name` is display-only.
--
-- 'admin' is not an HR department anyone's payroll sits under — it's the gating
-- department for Internal Portal access (an employee needs a department_access_grants
-- row scoped to it, at access_level='admin', to log in at all). 'pixxel' is the demo
-- employee's actual home department.

insert into departments (name, code)
values ('Admin', 'admin')
on conflict (code) do nothing;

insert into departments (name, code)
values ('Pixxel', 'pixxel')
on conflict (code) do nothing;
