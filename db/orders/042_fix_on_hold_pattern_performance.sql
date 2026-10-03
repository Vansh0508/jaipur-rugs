-- Production regression, 2026-10-03: the 041a-041g migrations (Jaipur Living on_hold_pattern
-- visibility, applied live ~06:00 but never committed under db/orders/) rewrote
-- orders_list_facets / orders_dashboard_stats / orders_filtered_summary and the
-- orders_with_on_time_status view with a `my_explicit_codes` CTE that is inlined and
-- re-evaluated per order row (private.current_employee_id() plus the RLS-guarded
-- merchant_customer_codes / department_access_grants lookups, for every one of ~48k
-- rows). That is the exact failure 037_fix_stock_visibility_performance.sql already fixed
-- once. Confirmed live via EXPLAIN as an `authenticated` user: both RPCs and the view's
-- is_hidden_stock column ran past a 20s statement_timeout (role limit is 8s), so Atlas's
-- /orders and /dashboard errored with 57014 right after sign-in.
--
-- Fix: resolve the employee once (`me`) and materialize the code set once
-- (`my_explicit_codes as materialized`), so the per-row EXISTS only scans a 0-14 row
-- in-memory CTE. Same signatures, same visibility rule (incl. on_hold_pattern), same
-- columns -- purely a performance change. Equivalent query measured at ~70ms.

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
set search_path to 'public', 'pg_temp'
as $function$
  with me as materialized (
    select private.current_employee_id() as id
  ),
  my_explicit_codes as materialized (
    select customer_no, null::text as on_hold_pattern
    from merchant_customer_codes
    where employee_id = (select id from me)
    union
    select dcc.customer_no, dcc.on_hold_pattern
    from department_customer_codes dcc
    join department_access_grants dag on dag.department_id = dcc.department_id
    where dag.employee_id = (select id from me)
  )
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
  where (
    customer_no not in ('0277', '0177', '0877', '0322', '0108')
    or exists (
      select 1 from my_explicit_codes mec
      where mec.customer_no = orders.customer_no
        and (mec.on_hold_pattern is null or orders.on_hold ilike mec.on_hold_pattern)
    )
  );
$function$;

create or replace function public.orders_dashboard_stats()
returns table (total bigint, distinct_sales_orders bigint, delayed_count bigint, counts_by_stage jsonb)
language sql
stable
set search_path to 'public', 'pg_temp'
as $function$
  with me as materialized (
    select private.current_employee_id() as id
  ),
  my_explicit_codes as materialized (
    select customer_no, null::text as on_hold_pattern
    from merchant_customer_codes
    where employee_id = (select id from me)
    union
    select dcc.customer_no, dcc.on_hold_pattern
    from department_customer_codes dcc
    join department_access_grants dag on dag.department_id = dcc.department_id
    where dag.employee_id = (select id from me)
  ),
  base as (
    select
      o.stage_id,
      o.sales_order_no,
      coalesce(o.revised_ex_factory_date, o.promised_delivery_date) as target_date,
      coalesce(s.is_terminal, false) as is_terminal
    from orders o
    left join stages s on s.id = o.stage_id
    where (
      o.customer_no not in ('0277', '0177', '0877', '0322', '0108')
      or exists (
        select 1 from my_explicit_codes mec
        where mec.customer_no = o.customer_no
          and (mec.on_hold_pattern is null or o.on_hold ilike mec.on_hold_pattern)
      )
    )
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
$function$;

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
  p_aging text default null,
  p_on_hold text default null,
  p_quick_ship text default null,
  p_delay_status text default null,
  p_terminal_stage_ids uuid[] default null,
  p_on_time_status text default null,
  p_due_from date default null,
  p_due_to date default null,
  p_ctype text default null,
  p_search text default null
)
returns table (total_count bigint, total_sqft numeric, by_status jsonb, by_stage jsonb)
language sql
stable
set search_path to 'public', 'pg_temp'
as $function$
  with me as materialized (
    select private.current_employee_id() as id
  ),
  my_explicit_codes as materialized (
    select customer_no, null::text as on_hold_pattern
    from merchant_customer_codes
    where employee_id = (select id from me)
    union
    select dcc.customer_no, dcc.on_hold_pattern
    from department_customer_codes dcc
    join department_access_grants dag on dag.department_id = dcc.department_id
    where dag.employee_id = (select id from me)
  ),
  d as (
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
      (
        p_include_stock
        or o.customer_no not in ('0277', '0177', '0877', '0322', '0108')
        or exists (
          select 1 from my_explicit_codes mec
          where mec.customer_no = o.customer_no
            and (mec.on_hold_pattern is null or o.on_hold ilike mec.on_hold_pattern)
        )
      )
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
$function$;

-- The view's is_hidden_stock column carried the same per-row CTE. `create or replace view`
-- keeps the column list/order and grants, but a WITHOUT-`with (...)` replace RESETS
-- reloptions: the first apply of this migration silently dropped security_invoker and
-- Supabase's security advisor flagged the view as SECURITY DEFINER (anon could have read
-- every order). Caught immediately and fixed with `alter view ... set (security_invoker
-- = true)`; the option is now part of the statement itself so re-running is safe. The
-- view MUST stay security_invoker (see 024_on_time_status_view.sql).
create or replace view public.orders_with_on_time_status
with (security_invoker = true)
as
with me as materialized (
  select private.current_employee_id() as id
),
my_explicit_codes as materialized (
  select merchant_customer_codes.customer_no,
         null::text as on_hold_pattern
  from merchant_customer_codes
  where merchant_customer_codes.employee_id = (select id from me)
  union
  select dcc.customer_no,
         dcc.on_hold_pattern
  from department_customer_codes dcc
  join department_access_grants dag on dag.department_id = dcc.department_id
  where dag.employee_id = (select id from me)
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
    o.customer_no = any (array['0277'::text, '0177'::text, '0877'::text, '0322'::text, '0108'::text])
    and not exists (
      select 1
      from my_explicit_codes mec
      where mec.customer_no = o.customer_no
        and (mec.on_hold_pattern is null or o.on_hold ilike mec.on_hold_pattern)
    )
  ) as is_hidden_stock
from orders o
left join stages s on s.id = o.stage_id;
