-- Orders module, file 2/3. RLS. SELECT-only on every table in this module — same "no
-- insert/update/delete policy anywhere, every write goes through a service-role Edge
-- Function" posture as the journeys module (db/journeys/005_journeys_rls.sql), for the
-- same reason: orders-sync, orders-update-stage, orders-set-shipping-detail, and
-- merchants-invite/merchants-link-clerk-account all run with the service role and
-- re-check authorization themselves (supabase/functions/_shared/authz.ts), so an RLS
-- write policy here would only ever be exercised by a client this module doesn't have.
--
-- `stages`/`status_stage_map` are open-read reference tables (same idiom as
-- departments/roles/apps in team-members) — both internal roles and merchants need to
-- read the stage list to render a timeline.

alter table stages enable row level security;
alter table status_stage_map enable row level security;
alter table orders enable row level security;
alter table order_stage_events enable row level security;
alter table shipping_details enable row level security;
alter table merchants enable row level security;
alter table merchant_customer_codes enable row level security;

create policy stages_select_all on stages for select to authenticated using (true);
create policy status_stage_map_select_all on status_stage_map for select to authenticated using (true);

-- ORDERS: the single private.can_view_order() predicate (001) covers admin permission,
-- production/shipping/sales department access, salesperson-code self-match, and the
-- Clerk-authenticated merchant match — defined once there instead of re-derived here.
create policy orders_select on orders for select to authenticated
  using (private.can_view_order(id));

-- ORDER_STAGE_EVENTS / SHIPPING_DETAILS: visibility follows the parent order exactly —
-- no separate authorization concept for "can see the timeline" vs "can see the order."
create policy order_stage_events_select on order_stage_events for select to authenticated
  using (private.can_view_order(order_id));

create policy shipping_details_select on shipping_details for select to authenticated
  using (private.can_view_order(order_id));

-- MERCHANTS / MERCHANT_CUSTOMER_CODES: staff with orders.read.all (admin) can see the
-- whole roster (needed for a future "manage merchants" screen); a merchant can see only
-- their own row(s) — matched the same way private.can_view_order() matches orders, by
-- the Clerk JWT's `sub` claim against clerk_user_id. No merchant, including one that
-- somehow guessed another merchant_id, can see a different merchant's codes.
create policy merchants_select on merchants for select to authenticated
  using (
    private.employee_has_permission(private.current_employee_id(), 'orders.read.all')
    or clerk_user_id = (select auth.jwt() ->> 'sub')
  );

create policy merchant_customer_codes_select on merchant_customer_codes for select to authenticated
  using (
    private.employee_has_permission(private.current_employee_id(), 'orders.read.all')
    or exists (
      select 1 from merchants m
      where m.id = merchant_customer_codes.merchant_id
        and m.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );
