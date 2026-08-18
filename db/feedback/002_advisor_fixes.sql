-- Follow-up migration addressing Supabase advisor findings from 001_feedback_schema.sql.
-- See MIGRATIONS.md for the full advisor run this responds to.

-- PERFORMANCE (WARN): auth_rls_initplan — both policies called `auth.uid()` directly,
-- re-evaluating it per row instead of once per statement. Wrapping in `(select auth.uid())`
-- forces an InitPlan. (drivers has no such issue — its policy doesn't reference auth.uid().)

drop policy guests_select_self on guests;
create policy guests_select_self on guests
  for select to authenticated
  using (auth_user_id = (select auth.uid()));

drop policy feedback_select_own on feedback;
create policy feedback_select_own on feedback
  for select to authenticated
  using (reviewer_auth_user_id = (select auth.uid()));
