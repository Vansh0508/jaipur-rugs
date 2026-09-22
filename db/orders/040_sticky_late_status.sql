-- Direct feedback, Back Ops walkthrough (transcript reviewed 2026-09-22): "Late" (the
-- stage-pace-projection warning, see 024_on_time_status_view.sql) needs to be STICKY --
-- once any stage of an order has ever run over its own standard, the order should keep
-- showing "Late" for the rest of its life, even if it recovers pace in a later stage.
-- Their own analogy: a train delayed at one station is presumed late at the destination
-- even if it makes up time in between; "Late" should mean "this has already happened at
-- least once," not "this is true again right now." Explicitly NOT to be renamed
-- "Probable Delay" -- "Late" is the name to keep (matches this app's own established
-- naming, confirmed with production 2026-09-07: "flag it as Late not delayed").
--
-- "Delayed" (revised/promised date already passed) is unaffected and unchanged -- it
-- already always takes precedence over "Late" wherever both could apply.
--
-- Implementation: a plain ratchet column, set once and never cleared by the ordinary
-- sync path (orders-sync.mjs remains the sole writer to `orders`, so a trigger there is
-- the natural place -- no application code needs to know this column exists to keep it
-- correct). A stored flag, not a derived-from-history computation, because per-stage
-- history genuinely isn't precise enough to derive this after the fact for most orders
-- (see the Stage History fix in this same batch of work) -- this starts tracking
-- accurately from today forward, seeded once below for orders already late/delayed right
-- now.

alter table orders add column ever_late boolean not null default false;

-- private.orders_on_time_status gains a 5th parameter, p_ever_late, defaulting to false
-- so any caller that hasn't been updated yet still gets the exact same (non-sticky)
-- behavior it always had. The old 4-arg signature is dropped rather than left as a
-- separate overload, so there is exactly one function to keep in sync with
-- lib/tat.ts's onTimeStatus() going forward, per that file's own "kept in sync by hand"
-- convention.
-- The view is recreated further down in this same migration, so dropping it here (to
-- free up the function signature it depends on) is safe.
drop view if exists orders_with_on_time_status;
drop function if exists private.orders_on_time_status(date, date, boolean, numeric);

create function private.orders_on_time_status(
  p_promised_delivery_date date,
  p_revised_ex_factory_date date,
  p_is_terminal boolean,
  p_stage_standard_days numeric,
  p_ever_late boolean default false
) returns text
language plpgsql
stable
set search_path = private, pg_temp
as $$
declare
  v_target date;
begin
  if p_is_terminal then
    return 'on_track';
  end if;
  v_target := coalesce(p_revised_ex_factory_date, p_promised_delivery_date);
  if v_target is null then
    return 'unknown';
  end if;
  if extract(year from v_target) < 1900 then
    return 'unknown';
  end if;
  if current_date > v_target then
    return 'delayed';
  end if;
  if p_stage_standard_days is not null and (current_date + p_stage_standard_days::int) > v_target then
    return 'late';
  end if;
  if p_ever_late then
    return 'late';
  end if;
  return 'on_track';
end;
$$;

-- Ratchet trigger: on every insert/update (i.e. every orders-sync.mjs upsert), recompute
-- the RAW (non-sticky, p_ever_late = false) point-in-time signal; if it comes back
-- late/delayed, latch ever_late on. Never cleared here -- the only way this column goes
-- back to false is a manual correction, which nothing in this migration does.
create or replace function private.mark_ever_late()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_is_terminal boolean;
  v_standard numeric;
  v_raw_status text;
begin
  select coalesce(is_terminal, false) into v_is_terminal from stages where id = new.stage_id;
  v_standard := private.stage_standard_days(new.raw_current_status, new.quality, new.size, new.std_cubage, new.order_priority, new.on_hold);
  v_raw_status := private.orders_on_time_status(new.promised_delivery_date, new.revised_ex_factory_date, v_is_terminal, v_standard, false);
  if v_raw_status in ('late', 'delayed') then
    new.ever_late := true;
  end if;
  return new;
end;
$$;

drop trigger if exists orders_mark_ever_late on orders;
create trigger orders_mark_ever_late
before insert or update on orders
for each row execute function private.mark_ever_late();

-- One-time seed: anything already late/delayed right now starts sticky immediately,
-- rather than everyone starting at false and losing the signal for orders that are
-- ALREADY in this state today.
update orders o
set ever_late = true
from stages s
where s.id = o.stage_id
  and private.orders_on_time_status(
    o.promised_delivery_date,
    o.revised_ex_factory_date,
    coalesce(s.is_terminal, false),
    private.stage_standard_days(o.raw_current_status, o.quality, o.size, o.std_cubage, o.order_priority, o.on_hold),
    false
  ) in ('late', 'delayed');

-- orders_with_on_time_status: add ever_late to the selected columns and fold it into
-- computed_on_time_status. Otherwise byte-identical to 037's version (same JLI
-- stock-visibility CTE/column, no other columns changed) -- copied forward rather than
-- reverting that fix.
create or replace view orders_with_on_time_status
with (security_invoker = true)
as
with my_explicit_codes as (
  select customer_no from merchant_customer_codes where employee_id = private.current_employee_id()
  union
  select dcc.customer_no
  from department_customer_codes dcc
  join department_access_grants dag on dag.department_id = dcc.department_id
  where dag.employee_id = private.current_employee_id()
)
select
  o.id,
  o.otn_no,
  o.item_no,
  o.sales_order_no,
  o.serial_no,
  o.production_order_no,
  o.customer_no,
  o.merchant_name,
  o.order_wise_merchant,
  o.customer_po_no,
  o.salesperson_code,
  o.raw_current_status,
  o.stage_id,
  o.current_status_pending_days,
  o.production_order_status,
  o.on_hold,
  o.order_priority,
  o."authorization",
  o.remark,
  o.quality,
  o.design,
  o.size,
  o.size_cm,
  o.shape,
  o.construction,
  o.india_collection,
  o.pile_fibre,
  o.pile_height,
  o.gr_color_name,
  o.br_color_name,
  o.matching_code,
  o.backing,
  o.std_cubage,
  o.item_description,
  o.us_item_code,
  o.quick_ship,
  o.warehouse_shipment_created,
  o.sales_order_date,
  o.revised_ex_factory_date,
  o.original_ex_factory_date,
  o.promised_delivery_date,
  o.expected_ready_date,
  o.follow_up_person,
  o.project_coordinator,
  o.erp_synced_at,
  o.created_at,
  o.updated_at,
  o.customer_service_zone,
  o.original_ex_india_date,
  o.revised_ex_india_date,
  o.hsn_sac_no,
  o.sales_line_no,
  o.current_location,
  o.ever_late,
  private.stage_standard_days(o.raw_current_status, o.quality, o.size, o.std_cubage, o.order_priority, o.on_hold) as computed_stage_standard_days,
  private.orders_on_time_status(
    o.promised_delivery_date,
    o.revised_ex_factory_date,
    coalesce(s.is_terminal, false),
    private.stage_standard_days(o.raw_current_status, o.quality, o.size, o.std_cubage, o.order_priority, o.on_hold),
    o.ever_late
  ) as computed_on_time_status,
  (
    o.customer_no in ('0277', '0177', '0877', '0322', '0108')
    and o.customer_no not in (select customer_no from my_explicit_codes)
  ) as is_hidden_stock
from orders o
left join stages s on s.id = o.stage_id;
