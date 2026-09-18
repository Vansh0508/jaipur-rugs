-- Orders module, file 18. Performance fix for /dashboard, /orders, and /rug-lens all
-- being slow on every navigation and every filter change -- reported directly by Ayaan,
-- 2026-09-11.
--
-- Root cause, confirmed live against the real 46,234-row `orders` table (13,633
-- non-stock) via EXPLAIN ANALYZE on matnispbauvvlnbsuzxq: `listOrderFacets` and
-- `listAllOrdersForStats` (apps/atlas/lib/queries/orders.ts) and
-- `listRugLensFacetValues` (apps/atlas/lib/queries/rugLens.ts) each pull EVERY matching
-- row back to Node in sequential 1000-row pages (PostgREST's per-request cap), then
-- dedupe/aggregate it in JS -- on every single page load, not once. That's ~14
-- sequential round trips for Orders' facet dropdowns + another ~14 for the Dashboard's
-- stat tiles (13,633 qualifying rows / 1000), and ~33 for RugLens' facet dropdowns
-- (32,601 stock-code rows / 1000) -- each trip paying full network round-trip latency
-- AND shipping ~1000 rows of raw text over the wire just to throw away everything but a
-- handful of distinct values or a count.
--
-- Fix: three plain SQL functions that do the same distinct/aggregate work Postgres is
-- already good at, in ONE round trip, returning only the small result the page actually
-- needs. None of these are SECURITY DEFINER -- they run as the calling role (the
-- default), so the existing `orders_select` RLS policy (002_orders_rls.sql, fixed for
-- row-independent-check performance in 009) still applies exactly as it does to a plain
-- `.from("orders").select()` call: a salesperson/merchant-scoped caller gets
-- facets/stats computed only over the rows they could already see, same as today, not a
-- privileged view of the whole table.
--
-- Measured live via EXPLAIN ANALYZE under a real (non-superuser) query shape:
-- orders_list_facets ~150ms (was ~14 sequential round trips), orders_dashboard_stats
-- ~100-1400ms depending on cache warmth (was ~14 sequential round trips, same cache-
-- warmth cost paid on EVERY one of those trips instead of once), rug_lens_facets
-- ~570ms (was ~33 sequential round trips).
--
-- STOCK_CUSTOMER_CODES (5 codes, excluded here as a literal -- same list as
-- apps/atlas/lib/queries/orders.ts's exported constant, keep both in sync if it ever
-- changes) and RugLens' final-location include/exclude keyword lists
-- (apps/atlas/lib/queries/rugLens.ts's FINAL_LOCATION_* constants) are duplicated here
-- rather than looked up -- SQL has no clean way to share a JS module's constant, and
-- there's no single source of truth for either today regardless of this migration.

-- ORDERS FACETS -- distinct values for every multi-select dropdown on /orders. Trims and
-- drops blanks exactly like listOrderFacets' JS loop did (String(value).trim().length /
-- .add(String(value).trim())), so behavior is unchanged, only where the work happens.
create or replace function public.orders_list_facets()
returns table (
  customer_no text[],
  merchant_name text[],
  order_wise_merchant text[],
  follow_up_person text[],
  customer_po_no text[],
  quality text[],
  design text[],
  size text[],
  production_order_status text[],
  priority text[]
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select
    coalesce(array_agg(distinct btrim(customer_no)) filter (where customer_no is not null and btrim(customer_no) <> ''), '{}'::text[]),
    coalesce(array_agg(distinct btrim(merchant_name)) filter (where merchant_name is not null and btrim(merchant_name) <> ''), '{}'::text[]),
    coalesce(array_agg(distinct btrim(order_wise_merchant)) filter (where order_wise_merchant is not null and btrim(order_wise_merchant) <> ''), '{}'::text[]),
    coalesce(array_agg(distinct btrim(follow_up_person)) filter (where follow_up_person is not null and btrim(follow_up_person) <> ''), '{}'::text[]),
    coalesce(array_agg(distinct btrim(customer_po_no)) filter (where customer_po_no is not null and btrim(customer_po_no) <> ''), '{}'::text[]),
    coalesce(array_agg(distinct btrim(quality)) filter (where quality is not null and btrim(quality) <> ''), '{}'::text[]),
    coalesce(array_agg(distinct btrim(design)) filter (where design is not null and btrim(design) <> ''), '{}'::text[]),
    coalesce(array_agg(distinct btrim(size)) filter (where size is not null and btrim(size) <> ''), '{}'::text[]),
    coalesce(array_agg(distinct btrim(production_order_status)) filter (where production_order_status is not null and btrim(production_order_status) <> ''), '{}'::text[]),
    coalesce(array_agg(distinct btrim(order_priority::text)) filter (where order_priority is not null), '{}'::text[])
  from orders
  where customer_no not in ('0277', '0177', '0877', '0322', '0108');
$$;

revoke all on function public.orders_list_facets() from public;
grant execute on function public.orders_list_facets() to authenticated;

-- DASHBOARD STATS -- total rug lines, distinct sales orders, delayed count, and a
-- per-stage count -- everything DashboardPage currently derives in JS from
-- listAllOrdersForStats()'s full row-set. `base` is referenced 4 times below; Postgres
-- materializes a multiply-referenced CTE once by default (confirmed via EXPLAIN ANALYZE:
-- one scan of `orders`/`stages`, not four), so this is one real pass over the data, not four.
--
-- delayed_count's condition is a direct port of lib/tat.ts's onTimeStatus(), specifically
-- the branch DashboardPage actually exercises (it always passes stageStandardDays=null,
-- so the "late" prediction branch never applies there -- see dashboard/page.tsx's own
-- comment on this) -- not terminal, a valid target date (revised_ex_factory_date falling
-- back to promised_delivery_date, excluding the "1753-01-01" SQL Server MinValue sentinel
-- via the year<1900 guard), and that date already in the past. If onTimeStatus() itself
-- ever changes, this must be updated to match -- it is a duplicate of that logic, not a
-- call to it, because SQL can't invoke the app's TypeScript.
create or replace function public.orders_dashboard_stats()
returns table (
  total bigint,
  distinct_sales_orders bigint,
  delayed_count bigint,
  counts_by_stage jsonb
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with base as (
    select
      o.stage_id,
      o.sales_order_no,
      coalesce(o.revised_ex_factory_date, o.promised_delivery_date) as target_date,
      coalesce(s.is_terminal, false) as is_terminal
    from orders o
    left join stages s on s.id = o.stage_id
    where o.customer_no not in ('0277', '0177', '0877', '0322', '0108')
  ),
  stage_counts as (
    select stage_id, count(*) as cnt
    from base
    where stage_id is not null
    group by stage_id
  )
  select
    (select count(*) from base) as total,
    (select count(distinct sales_order_no) from base) as distinct_sales_orders,
    (
      select count(*) from base
      where not is_terminal
        and target_date is not null
        and extract(year from target_date) >= 1900
        and target_date < current_date
    ) as delayed_count,
    coalesce((select jsonb_object_agg(stage_id::text, cnt) from stage_counts), '{}'::jsonb) as counts_by_stage;
$$;

revoke all on function public.orders_dashboard_stats() from public;
grant execute on function public.orders_dashboard_stats() to authenticated;

-- RUG LENS FACETS -- distinct Location/Quality values among rows matching RugLens' base
-- "open stock" condition (see rugLens.ts's own header comment for the full reasoning),
-- mirroring applyRugLensFilters() called with only includeHeldOrAssigned set (the exact
-- call listRugLensFacetValues made) -- location/quality/itemType/search filters
-- themselves are deliberately NOT applied here, same as today, so the two dropdowns stay
-- independent of each other and of whatever's currently selected.
create or replace function public.rug_lens_facets(include_held_or_assigned boolean default false)
returns table (
  locations text[],
  qualities text[]
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select
    coalesce(array_agg(distinct btrim(current_location)) filter (where current_location is not null and btrim(current_location) <> ''), '{}'::text[]),
    coalesce(array_agg(distinct btrim(quality)) filter (where quality is not null and btrim(quality) <> ''), '{}'::text[])
  from orders
  where customer_no in ('0277', '0177', '0877', '0322', '0108')
    and (
      current_location ilike '%warehouse%' or current_location ilike '%showroom%' or current_location ilike '%store%'
      or current_location ilike '%whse%' or current_location ilike '%godown%' or current_location ilike '%branch%'
      or current_location ilike '%finished%'
      or current_location = 'Jaipur Rugs Co. Ltd. (Empire Complex, Mumbai)'
      or current_location = 'Jaipur Rugs - Koregaon Park, PUNE'
      or current_location = 'JRCPL Raipur, CG'
    )
    and current_location not ilike '%unfinished%'
    and current_location not ilike '%consignee%'
    and current_location not ilike '%repair%'
    and current_location not ilike '%reject%'
    and current_location not ilike '%inspection%'
    and current_location not ilike '%return%'
    and current_location not ilike '%rework%'
    and current_location not ilike '%production%'
    and current_location not ilike '%dyeing%'
    and current_location not ilike '%washing%'
    and current_location not ilike '%packing%'
    and current_location not ilike '%rafoo%'
    and current_location not ilike '%thukai%'
    and current_location not ilike '%finishing%'
    and (
      include_held_or_assigned
      or (
        (customer_po_no is null or customer_po_no = '')
        and (on_hold is null or on_hold in ('', '0', 'No', 'no', 'NO'))
      )
    );
$$;

revoke all on function public.rug_lens_facets(boolean) from public;
grant execute on function public.rug_lens_facets(boolean) to authenticated;
