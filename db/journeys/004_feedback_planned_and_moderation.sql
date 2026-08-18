-- Journeys module, file 4/6. Splits feedback into "planned ride, auto-approved" vs
-- "unplanned ride, pending admin approval" (fraud-prevention ask from the Internal
-- Portal spec — an unplanned-ride review has no journey record to corroborate it, so it
-- sits pending until an internal-portal admin approves/rejects it).

create type feedback_review_status as enum ('pending', 'approved', 'rejected');

alter table feedback add column journey_id uuid references journeys(id);
alter table feedback add column review_status feedback_review_status not null default 'approved';
alter table feedback add column reviewed_by uuid references employees(id);
alter table feedback add column reviewed_at timestamptz;

create index feedback_journey_id_idx on feedback(journey_id);
create index feedback_reviewed_by_idx on feedback(reviewed_by);

-- The `submit-feedback` edge function (extended separately) is what actually sets
-- review_status='pending' for unplanned submissions — the column default of 'approved'
-- above only covers direct-insert safety.

-- Combine into ONE select policy (own OR admin), not two separate permissive policies —
-- db/feedback/002_advisor_fixes.sql already established that as the fix for the perf
-- advisor's "multiple_permissive_policies" warning; don't reintroduce it here.
drop policy feedback_select_own on feedback;
create policy feedback_select on feedback for select to authenticated
  using (
    reviewer_auth_user_id = (select auth.uid())
    or private.is_internal_portal_admin(private.current_employee_id())
  );
-- No INSERT/UPDATE policy — unchanged: submit-feedback and approve-feedback (both
-- service-role) remain the only write paths.
