-- Orders module, file 32. Filter-aware totals for the /orders page's summary panel —
-- direct request from the production team's UAT walkthrough (2026-09-17). They were
-- explicit that they do NOT want another table column; they want totals that follow
-- whatever filters are currently on ("filter one customer, and see up top how many
-- square feet of theirs are delayed, how many pieces") instead of exporting to Excel and
-- summing by hand every time.
--
-- Why an RPC and not a sum over the rows on screen: /orders is paginated server-side
-- (listOrders -> .range()), so the page only ever holds 20-500 of the matching rows —
-- summing those would be wrong for every filter that matches more than one page. This
-- aggregates over the FULL filtered set in one round trip (same shape of fix as 018).
--
-- Every parameter mirrors one branch of applyOrderFilters() in
-- apps/atlas/lib/queries/orders.ts, predicate for predicate, and the two must stay in
-- sync (SQL can't call the app's TypeScript — the same duplication 018/024 already live
-- with). getOrdersSummary() there is the only caller and owns the OrderFilters ->
-- argument mapping. Built-in drift check: total_count here must always equal the exact
-- count listOrders returns for the same filters — if the two ever disagree on screen,
-- one of these predicates has drifted.
--
-- Reads through orders_with_on_time_status (security_invoker view, 024) rather than the
-- bare orders table: same orders_select RLS scoping as every other query in this app,
-- and computed_on_time_status is the SAME pace-aware status the per-row "On Time" badge
-- and the "Late" tab already use, so the panel's Delayed/Late/On-track split can never
-- disagree with the badges in the table below it. Measured live before writing this: the
-- full aggregate over all 13,835 non-stock rows (including both per-row private.*
-- function calls the view makes) runs in ~280ms.
--
-- Square feet = std_cubage — the "Std Cubage" NAV field, already synced, and already the
-- unit SWATCH_MAX_SQFT compares against. A null std_cubage counts as 0 sq ft but still
-- counts as one piece.
--
-- "Today" is the UTC calendar date, explicitly — applyOrderFilters() uses
-- new Date().toISOString().slice(0, 10), i.e. UTC — rather than trusting the session
-- timezone (see 027 for why that distinction has already bitten this module once).

create or replace function public.orders_filtered_summary(
  p_include_stock boolean default false,
  p_stage_ids uuid[] default null,
  p_customer_nos text[] default null,
  p_merchant_names text[] default null,
  p_order_wise_merchants text[] default null,
  p_follow_up_people text[] default null,
  p_customer_po_nos text[] default null,
  p_qualities text[] default null,
  p_designs text[] default null,
  p_sizes text[] default null,
  p_production_order_statuses text[] default null,
  p_priorities integer[] default null,
  p_aging text default null,             -- '0-7' | '8-15' | '16-30' | '30+'
  p_on_hold text default null,           -- 'yes' | 'no'
  p_quick_ship text default null,        -- 'yes' | 'no'
  p_delay_status text default null,      -- 'late' | 'soon' | 'on_track' | 'late_or_soon'
  p_terminal_stage_ids uuid[] default null,
  p_on_time_status text default null,    -- 'on_track' | 'late' | 'delayed' | 'unknown'
  p_due_from date default null,
  p_due_to date default null,
  p_ctype text default null,             -- 'knotted' | 'tufted' | 'handloom' | 'other' | 'swatch'
  p_search text default null
)
returns table (
  total_count bigint,
  total_sqft numeric,
  -- {"on_track": {"count": n, "sqft": x}, "late": {...}, "delayed": {...}, "unknown": {...}}
  -- — only statuses actually present in the filtered set appear as keys.
  by_status jsonb,
  -- {"<stage_id>": {"count", "sqft", "delayed_count", "delayed_sqft", "late_count",
  -- "late_sqft", "on_track_count", "on_track_sqft"}} — only stages with >= 1 matching
  -- row appear; rows with a null stage_id count toward the totals but not here.
  by_stage jsonb
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with d as (
    select (now() at time zone 'utc')::date as today
  ),
  base as (
    select
      o.stage_id,
      o.computed_on_time_status as status,
      coalesce(o.std_cubage, 0) as sqft
    from orders_with_on_time_status o
    cross join d
    where
      (p_include_stock or o.customer_no not in ('0277', '0177', '0877', '0322', '0108'))
      and (p_stage_ids is null or o.stage_id = any(p_stage_ids))
      and (p_customer_nos is null or o.customer_no = any(p_customer_nos))
      and (p_merchant_names is null or o.merchant_name = any(p_merchant_names))
      and (p_order_wise_merchants is null or o.order_wise_merchant = any(p_order_wise_merchants))
      and (p_follow_up_people is null or o.follow_up_person = any(p_follow_up_people))
      and (p_customer_po_nos is null or o.customer_po_no = any(p_customer_po_nos))
      and (p_qualities is null or o.quality = any(p_qualities))
      and (p_designs is null or o.design = any(p_designs))
      and (p_sizes is null or o.size = any(p_sizes))
      and (p_production_order_statuses is null or o.production_order_status = any(p_production_order_statuses))
      and (p_priorities is null or o.order_priority = any(p_priorities))
      and (
        p_aging is null
        or (p_aging = '0-7'   and o.current_status_pending_days between 0 and 7)
        or (p_aging = '8-15'  and o.current_status_pending_days between 8 and 15)
        or (p_aging = '16-30' and o.current_status_pending_days between 16 and 30)
        or (p_aging = '30+'   and o.current_status_pending_days >= 31)
      )
      -- on_hold is the raw ERP text, not a boolean — same truthy rule as applyOrderFilters.
      and (
        p_on_hold is null
        or (p_on_hold = 'yes' and o.on_hold is not null and o.on_hold not in ('', '0', 'No', 'no', 'NO'))
        or (p_on_hold = 'no'  and (o.on_hold is null or o.on_hold in ('', '0', 'No', 'no', 'NO')))
      )
      and (
        p_quick_ship is null
        or (p_quick_ship = 'yes' and o.quick_ship = true)
        or (p_quick_ship = 'no'  and o.quick_ship = false)
      )
      -- delayStatus: the tab bar's simple date-window buckets (NOT computed_on_time_status),
      -- terminal stages excluded whenever it's set — see OrderFilters.delayStatus's doc.
      and (
        p_delay_status is null
        or (
          (p_terminal_stage_ids is null or not (o.stage_id = any(p_terminal_stage_ids)))
          and (
            (p_delay_status = 'late'         and o.revised_ex_factory_date < d.today)
            or (p_delay_status = 'soon'      and o.revised_ex_factory_date between d.today and d.today + 7)
            or (p_delay_status = 'on_track'  and (o.revised_ex_factory_date is null or o.revised_ex_factory_date > d.today + 7))
            or (p_delay_status = 'late_or_soon' and o.revised_ex_factory_date <= d.today + 7)
          )
        )
      )
      and (p_on_time_status is null or o.computed_on_time_status = p_on_time_status)
      and (p_due_from is null or o.revised_ex_factory_date >= p_due_from)
      and (p_due_to is null or o.revised_ex_factory_date <= p_due_to)
      -- Construction type — see applyConstructionTypeFilter(); "swatch" (0 < Std Cubage
      -- < 4 sq ft) wins over every quality-string rule, so the others all require not-swatch.
      and (
        p_ctype is null
        or (p_ctype = 'swatch' and o.std_cubage > 0 and o.std_cubage < 4)
        or (
          (o.std_cubage is null or o.std_cubage <= 0 or o.std_cubage >= 4)
          and (
            (p_ctype = 'knotted'  and o.quality like '%/%')
            or (p_ctype = 'tufted'   and o.quality ilike '%tufted%')
            or (p_ctype = 'handloom' and o.quality ilike '%handloom%')
            or (
              p_ctype = 'other'
              and o.quality not like '%/%'
              and o.quality not ilike '%tufted%'
              and o.quality not ilike '%handloom%'
            )
          )
        )
      )
      and (
        p_search is null or p_search = ''
        or o.otn_no ilike '%' || p_search || '%'
        or o.item_no ilike '%' || p_search || '%'
        or o.sales_order_no ilike '%' || p_search || '%'
        or o.customer_no ilike '%' || p_search || '%'
        or o.merchant_name ilike '%' || p_search || '%'
        or o.order_wise_merchant ilike '%' || p_search || '%'
        or o.customer_po_no ilike '%' || p_search || '%'
        or o.quality ilike '%' || p_search || '%'
        or o.design ilike '%' || p_search || '%'
        or o.size ilike '%' || p_search || '%'
        or o.follow_up_person ilike '%' || p_search || '%'
        or o.raw_current_status ilike '%' || p_search || '%'
      )
  ),
  grouped as (
    select stage_id, status, count(*)::bigint as cnt, sum(sqft) as sqft
    from base
    group by stage_id, status
  ),
  per_status as (
    select status, sum(cnt)::bigint as cnt, sum(sqft) as sqft
    from grouped
    group by status
  ),
  per_stage as (
    select
      stage_id,
      sum(cnt)::bigint as cnt,
      sum(sqft) as sqft,
      coalesce(sum(cnt) filter (where status = 'delayed'), 0)::bigint as delayed_cnt,
      coalesce(sum(sqft) filter (where status = 'delayed'), 0) as delayed_sqft,
      coalesce(sum(cnt) filter (where status = 'late'), 0)::bigint as late_cnt,
      coalesce(sum(sqft) filter (where status = 'late'), 0) as late_sqft,
      coalesce(sum(cnt) filter (where status = 'on_track'), 0)::bigint as on_track_cnt,
      coalesce(sum(sqft) filter (where status = 'on_track'), 0) as on_track_sqft
    from grouped
    where stage_id is not null
    group by stage_id
  )
  select
    coalesce((select sum(cnt) from grouped), 0)::bigint as total_count,
    coalesce((select sum(sqft) from grouped), 0) as total_sqft,
    coalesce(
      (select jsonb_object_agg(status, jsonb_build_object('count', cnt, 'sqft', sqft)) from per_status),
      '{}'::jsonb
    ) as by_status,
    coalesce(
      (
        select jsonb_object_agg(
          stage_id::text,
          jsonb_build_object(
            'count', cnt,
            'sqft', sqft,
            'delayed_count', delayed_cnt,
            'delayed_sqft', delayed_sqft,
            'late_count', late_cnt,
            'late_sqft', late_sqft,
            'on_track_count', on_track_cnt,
            'on_track_sqft', on_track_sqft
          )
        )
        from per_stage
      ),
      '{}'::jsonb
    ) as by_stage;
$$;

revoke all on function public.orders_filtered_summary(
  boolean, uuid[], text[], text[], text[], text[], text[], text[], text[], text[], text[],
  integer[], text, text, text, text, uuid[], text, date, date, text, text
) from public;
grant execute on function public.orders_filtered_summary(
  boolean, uuid[], text[], text[], text[], text[], text[], text[], text[], text[], text[],
  integer[], text, text, text, text, uuid[], text, date, date, text, text
) to authenticated;
