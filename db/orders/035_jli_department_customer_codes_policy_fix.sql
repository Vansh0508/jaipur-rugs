-- Orders module. Advisor fix for 034: department_customer_codes_write used `for all`,
-- which (per Postgres RLS semantics) also covers SELECT -- overlapping with the
-- dedicated department_customer_codes_select policy and triggering the
-- "multiple_permissive_policies" performance lint (two permissive SELECT policies means
-- Postgres evaluates both on every read). Split into insert/update/delete instead, same
-- as every other write-gated reference table should but sometimes doesn't in this repo
-- (departments_write has the identical latent issue, pre-existing, not touched here --
-- out of scope for this migration).

drop policy department_customer_codes_write on department_customer_codes;

create policy department_customer_codes_insert on department_customer_codes for insert to authenticated
  with check (private.employee_has_permission(private.current_employee_id(), 'departments.manage'));

create policy department_customer_codes_update on department_customer_codes for update to authenticated
  using (private.employee_has_permission(private.current_employee_id(), 'departments.manage'))
  with check (private.employee_has_permission(private.current_employee_id(), 'departments.manage'));

create policy department_customer_codes_delete on department_customer_codes for delete to authenticated
  using (private.employee_has_permission(private.current_employee_id(), 'departments.manage'));
