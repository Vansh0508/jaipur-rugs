-- Orders module, file 5. Advisor fixes, applied immediately after 001-004 (Section 3.1
-- step 5) — same convention as db/team-members/002_advisor_fixes.sql and
-- db/journeys/006_advisor_fixes.sql. Two findings from get_advisors after applying 001-004
-- to matnispbauvvlnbsuzxq on 2026-08-27:
--
-- 1. auth_rls_initplan (WARN, real regression): merchants_select and
--    merchant_customer_codes_select (002_orders_rls.sql) called auth.jwt() directly,
--    re-evaluating it per row instead of once per query. private.can_view_order() (001)
--    already got this right — these two policies just missed the same treatment.
--    NOTE on exact shape: `(select (auth.jwt() ->> 'sub'))` — wrapping the whole
--    `->>` expression — did NOT clear the lint on this project/Postgres version; only
--    wrapping the bare function call, `(select auth.jwt()) ->> 'sub'`, did. Confirmed by
--    re-running get_advisors after each attempt on 2026-08-27. Match this exact shape
--    for any future auth.jwt()/auth.uid() policy in this module.
-- 2. unindexed_foreign_keys (INFO, x11): every FK added by 004's workflow/escalation
--    tables lacked a covering index. Everything else the advisor flagged (unused_index
--    on brand-new, zero-traffic tables; the pre-existing project-wide
--    auth_leaked_password_protection warning) is noise, not a real finding here.

drop policy merchants_select on merchants;
create policy merchants_select on merchants for select to authenticated
  using (
    private.employee_has_permission(private.current_employee_id(), 'orders.read.all')
    or clerk_user_id = ((select auth.jwt()) ->> 'sub')
  );

drop policy merchant_customer_codes_select on merchant_customer_codes;
create policy merchant_customer_codes_select on merchant_customer_codes for select to authenticated
  using (
    private.employee_has_permission(private.current_employee_id(), 'orders.read.all')
    or exists (
      select 1 from merchants m
      where m.id = merchant_customer_codes.merchant_id
        and m.clerk_user_id = ((select auth.jwt()) ->> 'sub')
    )
  );

create index order_stage_events_stage_id_idx on order_stage_events(stage_id);
create index order_stage_events_recorded_by_idx on order_stage_events(recorded_by);
create index shipping_details_updated_by_idx on shipping_details(updated_by);
create index order_requests_requested_by_idx on order_requests(requested_by);
create index order_requests_actioned_by_idx on order_requests(actioned_by);
create index order_request_seen_employee_id_idx on order_request_seen(employee_id);
create index order_milestones_recorded_by_idx on order_milestones(recorded_by);
create index order_events_actor_employee_id_idx on order_events(actor_employee_id);
create index escalation_levels_notify_employee_id_idx on escalation_levels(notify_employee_id);
create index order_escalations_level_idx on order_escalations(level);
create index order_escalations_escalated_by_idx on order_escalations(escalated_by);
