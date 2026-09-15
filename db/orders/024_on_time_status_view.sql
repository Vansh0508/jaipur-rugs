-- Ports the "Late" (pace-projection) side of this app's own on-time-status logic into
-- Postgres, so the Orders top tab bar's "Late" tab can filter/count/paginate correctly
-- across the FULL dataset (13,685+ rows), not just whatever page happens to be loaded —
-- direct request, 2026-09-15, confirmed: "Late" must mean the real pace-projection
-- warning already used by the per-row "On Time" badge (apps/atlas/lib/tat.ts's
-- onTimeStatus, from a real production conversation, 2026-09-07: "flag it as Late not
-- delayed"), not just a synonym for "Delayed" (already-past-due, which the tab bar's
-- other four tabs already handle with plain date filters — no port needed for those).
--
-- *** WRITTEN, NOT YET APPLIED. Needs live cross-validation before the frontend "Late"
-- tab is wired to it — both for CORRECTNESS (compare this SQL port's output against the
-- real apps/atlas/lib/stageTat.ts + lib/tat.ts TypeScript, row by row, on real data —
-- regex/lookup ports are exactly the kind of thing that can be subtly wrong in a way
-- code review alone won't catch) and for PERFORMANCE (EXPLAIN ANALYZE a real "Late" tab
-- query — this can't use a plain index, since on_time_status is a computed expression,
-- not a stored column, so filtering on it is a sequential scan with a per-row function
-- call; db/orders/009_orders_select_perf_fix.sql is the cautionary precedent for
-- exactly this shape of problem in this exact module). Do not point the frontend at
-- orders_with_on_time_status until both checks have actually been run against live
-- data, not just inspected by eye. ***
--
-- Ported line-for-line from apps/atlas/lib/stageTat.ts (stageStandard/loomStandardDays/
-- maxDimensionFt/ZERO_PRIORITY_KNOTTED_RATE/STATUS_TAT_RULES) and
-- apps/atlas/lib/tat.ts (onTimeStatus) as of 2026-09-15 — if either TypeScript file
-- changes, this SQL must be updated to match, the same "keep the app code and this SQL
-- in sync by hand" caution db/orders/020's own header already gives for
-- applyRugLensFilters/rug_lens_facets().
--
-- Everything here lives in `private` (not `public`) — not because it's a security
-- check, but because it doesn't need to be its own callable REST endpoint; it's only
-- ever invoked from inside the view below. Following the same "least exposure by
-- default" habit AGENTS.md Section 10 already established for this project, even though
-- the original reason (auth helpers, not business logic) doesn't strictly apply here.

-- Zero-priority knotted quality -> exact daily weaving rate (inches/day), confirmed
-- directly by production, 2026-09-07 ("Zero Priority Per Day Standard Work.xlsx") — see
-- stageTat.ts's own comment: a real per-quality lookup, not a formula, because
-- production's numbers don't follow the tiered fallback cleanly. This table is the
-- "real stage_tat_rules reference table" stageTat.ts's own header comment already said
-- this data should eventually move to.
create table private.zero_priority_knotted_rate (
  quality_key text primary key,
  rate numeric not null
);

insert into private.zero_priority_knotted_rate (quality_key, rate) values
  ('3/16', 8), ('3/20', 8), ('3/25', 8), ('4/25', 6), ('5/5', 6), ('6.5/36', 6),
  ('6/5', 6), ('6/6', 4), ('6/8', 5.5), ('8/8', 3), ('9/9', 2.25), ('10/10', 2),
  ('10/14', 2), ('11/11', 1.75), ('14/14', 1), ('7/7', 4), ('9/7', 3), ('5/16', 7),
  ('3.5/18', 10), ('4/15', 10), ('3/12', 10), ('4/22', 10), ('3/13', 10),
  ('3.5/22', 10), ('7/22', 6), ('3.5/18 WL', 10), ('8/6', 5.5), ('2.5/14', 10),
  ('6/20', 6), ('5/15', 6), ('6/4', 6), ('3/7', 8), ('5/25', 7), ('3/15', 8),
  ('5/22', 7), ('5/21', 7), ('3.5/25', 8), ('3/10', 8), ('5.5/30', 8), ('5/32', 8),
  ('4.25/30', 8), ('5/35', 8);

-- Parses an ERP size string (e.g. "25'5X46", "6X9'1", 20"X20"") and returns the largest
-- dimension in feet — port of maxDimensionFt(). Approximate on purpose (largest number
-- found, a bare number treated as feet unless marked with a literal " for inches) —
-- same as the TS version, only used to pick a weaving-rate bucket.
create or replace function private.max_dimension_ft(p_size text)
returns numeric
language sql
immutable
as $$
  select max(case when unit = '"' then num_value / 12 else num_value end)
  from (
    select (m[1])::numeric as num_value, m[2] as unit
    from regexp_matches(p_size, '(\d+(?:\.\d+)?)\s*([''"]?)', 'g') as m
  ) parsed
  where num_value > 0;
$$;

-- Port of loomStandardDays(). Handloom/tufted/dhurrie-flatweave all get a flat 12 days;
-- knotted qualities (an n/m knot-count pattern in the quality string) get a real rate:
-- the exact zero-priority lookup above where one exists, else a coarser tiered guess by
-- knot count (finer knotting assumed slower).
create or replace function private.loom_standard_days(
  p_quality text,
  p_size text,
  p_order_priority int
) returns numeric
language plpgsql
immutable
as $$
declare
  v_knot_match text[];
  v_whole_match text;
  v_knot_count numeric;
  v_dim_ft numeric;
  v_rate numeric;
  v_bare_pattern text;
begin
  if p_quality is null then
    return null;
  end if;
  if p_quality ~* 'handloom' then
    return 12;
  end if;
  if p_quality ~* 'tufted' then
    return 12;
  end if;

  v_knot_match := regexp_match(p_quality, '((\d+(?:\.\d+)?)\s*/\s*\d+(?:\.\d+)?(?:\s+\S+)?)', 'i');
  if v_knot_match is null then
    return 12; -- dhurrie/flat-weave — same flat standard as Tufted/Handloom
  end if;
  v_whole_match := v_knot_match[1];
  v_knot_count := v_knot_match[2]::numeric;

  v_dim_ft := private.max_dimension_ft(p_size);
  if v_dim_ft is null then
    return null;
  end if;

  if p_order_priority = 0 then
    v_bare_pattern := (regexp_split_to_array(trim(v_whole_match), '\s+'))[1];
    select rate into v_rate from private.zero_priority_knotted_rate where quality_key = trim(p_quality);
    if v_rate is null then
      select rate into v_rate from private.zero_priority_knotted_rate where quality_key = v_bare_pattern;
    end if;
  end if;

  if v_rate is null then
    v_rate := case
      when v_knot_count < 6 then 3
      when v_knot_count <= 9 then 2
      when v_knot_count <= 11 then 1.5
      else 1
    end;
  end if;

  return ceil((v_dim_ft * 12) / v_rate);
end;
$$;

-- Port of stageStandard() — returns just the standard-days number (null for on_hold, a
-- swatch/sample with no cubage set some other way, or no matching rule at all); the
-- fuller breached/within/no_standard/on_hold status distinction that column display
-- uses doesn't matter for onTimeStatus() below, which only ever checks "is this null or
-- not" (see that function's own JS source — on_hold orders can still be flagged
-- delayed/late by date alone, same as this port).
create or replace function private.stage_standard_days(
  p_raw_current_status text,
  p_quality text,
  p_size text,
  p_std_cubage numeric,
  p_order_priority int,
  p_on_hold text
) returns numeric
language plpgsql
immutable
as $$
declare
  v_is_on_hold boolean;
begin
  v_is_on_hold := p_on_hold is not null and trim(p_on_hold) <> '' and trim(p_on_hold) !~* '^(0|no)$';
  if v_is_on_hold then
    return null;
  end if;

  if p_std_cubage is not null and p_std_cubage > 0 and p_std_cubage < 4 then
    return 15; -- swatch/sample — one flat standard for the whole pipeline
  end if;

  if p_raw_current_status is not null
     and p_raw_current_status ~* 'loom'
     and p_raw_current_status !~* 'preloom|pre-loom' then
    return private.loom_standard_days(p_quality, p_size, p_order_priority);
  end if;

  if p_raw_current_status is null then
    return null;
  end if;

  -- First match wins, order matters — same as STATUS_TAT_RULES' array order.
  if p_raw_current_status ~* 'order\s*process' then
    return 2;
  elsif p_raw_current_status ~* 'design' then
    return case when p_order_priority = 0 then 7 else 15 end;
  elsif p_raw_current_status ~* 'ppc' then
    return 1;
  elsif p_raw_current_status ~* 'stores?' then
    return case when p_order_priority = 0 then 12 else 10 end;
  elsif p_raw_current_status ~* 'branch' then
    return case when p_order_priority = 0 then 7 else 10 end;
  elsif p_raw_current_status ~* 'in[\s-]*transit' then
    return case when p_order_priority = 0 then 7 else 10 end;
  elsif p_raw_current_status ~* 'repair' then
    return case when p_order_priority = 0 then 3 else 2 end;
  elsif p_raw_current_status ~* 'finish(ing)?' then
    return case when p_order_priority = 0 then 10 else 15 end;
  elsif p_raw_current_status ~* 'check(ing)?|inspection' then
    return 2;
  else
    return null;
  end if;
end;
$$;

-- Port of onTimeStatus(). STABLE not IMMUTABLE (unlike the two helpers above) — its
-- result depends on current_date, not just its arguments, so it must be re-evaluated
-- per statement, never cached/constant-folded across calls the way a truly immutable
-- function could be.
create or replace function private.orders_on_time_status(
  p_promised_delivery_date date,
  p_revised_ex_factory_date date,
  p_is_terminal boolean,
  p_stage_standard_days numeric
) returns text
language plpgsql
stable
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
  -- SQL Server DateTime.MinValue leaking through as "1753-01-01" — same guard
  -- displayDate.ts/orders-sync.mjs already apply everywhere else this app touches dates.
  if extract(year from v_target) < 1900 then
    return 'unknown';
  end if;
  if current_date > v_target then
    return 'delayed';
  end if;
  if p_stage_standard_days is not null and (current_date + p_stage_standard_days::int) > v_target then
    return 'late';
  end if;
  return 'on_track';
end;
$$;

-- The view listOrders() (apps/atlas/lib/queries/orders.ts) would query FROM instead of
-- the bare `orders` table, once wired up — same RLS as orders itself
-- (security_invoker = true makes this run as the CALLING user, not the view owner, so
-- orders_select's policy still scopes every row exactly as it does querying `orders`
-- directly), with two extra computed columns PostgREST can filter/sort on like any
-- other. NOT referenced by any application code yet — see this file's header.
create view orders_with_on_time_status
with (security_invoker = true)
as
select
  o.*,
  private.stage_standard_days(o.raw_current_status, o.quality, o.size, o.std_cubage, o.order_priority, o.on_hold)
    as computed_stage_standard_days,
  private.orders_on_time_status(
    o.promised_delivery_date,
    o.revised_ex_factory_date,
    coalesce(s.is_terminal, false),
    private.stage_standard_days(o.raw_current_status, o.quality, o.size, o.std_cubage, o.order_priority, o.on_hold)
  ) as computed_on_time_status
from orders o
left join stages s on s.id = o.stage_id;
