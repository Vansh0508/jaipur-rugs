-- Orders module, file 20. RugLens facet speed-up, part 2 -- replaces
-- rug_lens_facets(boolean) from 018_perf_facets_and_stats_rpcs.sql with a
-- cross-filter-aware version matching what lib/queries/rugLens.ts actually does today.
--
-- That original single-argument version predates RugLens' cross-filtering feature
-- (Location/Quality/Size narrowing each other down as you pick) and was never wired
-- into the app for exactly that reason -- see lib/queries/rugLens.ts's own incident
-- note and db/MIGRATIONS.md's 2026-09-11 outage entry for the full story: an earlier
-- session's in-progress edit called this RPC before its own migration had actually been
-- applied, and broke every real /rug-lens page load in production until reverted. That
-- note explicitly said not to reach for an RPC here again until (a) it's confirmed live
-- in pg_proc and (b) Ayaan has explicitly signed off. Both are true now -- 018 was
-- applied and verified live on 2026-09-11, and Ayaan directly asked for RugLens to get
-- the same speed-up next -- so this migration extends the RPC to match current
-- cross-filter behavior instead of quietly reintroducing the old, narrower one.
--
-- Mirrors applyRugLensFilters()/distinctFacetValues()/listRugLensFacets() in
-- lib/queries/rugLens.ts exactly: `base` narrows to every condition that applies to
-- ALL three facets (final-location baseline, available/PO/hold unless
-- p_include_held_or_assigned, itemType, search) ONCE; each output array is then
-- computed against `base` filtered by the OTHER TWO array filters only, never its own --
-- so picking a Location narrows Quality/Size, and vice versa, without a facet ever
-- hiding a value already selected from itself. `base` is referenced 3 times below;
-- Postgres materializes a multiply-referenced CTE once by default (same pattern already
-- verified working for orders_dashboard_stats() in 018), so this is one real scan of
-- `orders`, not three separate paginated passes like the code this replaces.

drop function if exists public.rug_lens_facets(boolean);

create or replace function public.rug_lens_facets(
  p_location text[] default '{}'::text[],
  p_quality text[] default '{}'::text[],
  p_size text[] default '{}'::text[],
  p_item_type text default null,
  p_search text default null,
  p_include_held_or_assigned boolean default false
)
returns table (
  locations text[],
  qualities text[],
  sizes text[]
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with base as (
    select current_location, quality, size
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
        p_include_held_or_assigned
        or (
          (customer_po_no is null or customer_po_no = '')
          and (on_hold is null or on_hold in ('', '0', 'No', 'no', 'NO'))
        )
      )
      -- itemType: "sample" = swatch by size (Std Cubage > 0 and < 4 sq ft -- the same
      -- SWATCH_MAX_SQFT rule Orders' own Construction filter uses); "rug" = everything
      -- else, NULL std_cubage included explicitly (it matches neither side of a plain
      -- < / >= comparison otherwise). IS DISTINCT FROM (not <>) so a null p_item_type
      -- (no itemType filter) never turns either whole AND branch into an unknown/false.
      and (p_item_type is distinct from 'sample' or (std_cubage > 0 and std_cubage < 4))
      and (p_item_type is distinct from 'rug' or (std_cubage <= 0 or std_cubage >= 4 or std_cubage is null))
      and (
        p_search is null or btrim(p_search) = '' or (
          design ilike '%' || p_search || '%'
          or gr_color_name ilike '%' || p_search || '%'
          or br_color_name ilike '%' || p_search || '%'
          or quality ilike '%' || p_search || '%'
          or size ilike '%' || p_search || '%'
          or current_location ilike '%' || p_search || '%'
          or item_no ilike '%' || p_search || '%'
          or serial_no ilike '%' || p_search || '%'
          or customer_no ilike '%' || p_search || '%'
          or customer_po_no ilike '%' || p_search || '%'
          or on_hold ilike '%' || p_search || '%'
        )
      )
  )
  select
    coalesce(
      (select array_agg(distinct btrim(current_location)) filter (where current_location is not null and btrim(current_location) <> '')
       from base
       where (cardinality(p_quality) = 0 or quality = any(p_quality))
         and (cardinality(p_size) = 0 or size = any(p_size))),
      '{}'::text[]
    ) as locations,
    coalesce(
      (select array_agg(distinct btrim(quality)) filter (where quality is not null and btrim(quality) <> '')
       from base
       where (cardinality(p_location) = 0 or current_location = any(p_location))
         and (cardinality(p_size) = 0 or size = any(p_size))),
      '{}'::text[]
    ) as qualities,
    coalesce(
      (select array_agg(distinct btrim(size)) filter (where size is not null and btrim(size) <> '')
       from base
       where (cardinality(p_location) = 0 or current_location = any(p_location))
         and (cardinality(p_quality) = 0 or quality = any(p_quality))),
      '{}'::text[]
    ) as sizes;
$$;

revoke all on function public.rug_lens_facets(text[], text[], text[], text, text, boolean) from public;
grant execute on function public.rug_lens_facets(text[], text[], text[], text, text, boolean) to authenticated;
