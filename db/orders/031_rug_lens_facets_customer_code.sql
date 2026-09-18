-- Orders module, file 31. Adds Customer Code as a fourth RugLens filter, direct
-- request 2026-09-17 ("give option to filter customer codes also") -- cross-filtered
-- against Location/Quality/Size exactly the same way those three already cross-filter
-- each other (020_rug_lens_facets_cross_filter.sql): each facet's own option list is
-- computed from every OTHER current selection but never its own, so picking a value
-- never hides itself from its own dropdown.
--
-- customer_no here is one of the 5 STOCK_CUSTOMER_CODES (0277/0177/0877/0322/0108) --
-- RugLens already restricts to just these as its whole baseline (see this function's
-- own WHERE clause, unchanged) -- so "Customer Code" is a within-baseline narrowing,
-- same shape as Quality/Size, not a new kind of restriction.
--
-- Adding a parameter changes this function's signature -- Postgres treats a different
-- argument LIST (not just different defaults) as a distinct overload, so a plain
-- `create or replace` here would leave the old 6-arg version sitting alongside this new
-- 7-arg one rather than actually replacing it. Drop the old signature explicitly first.
drop function if exists public.rug_lens_facets(text[], text[], text[], text, text, boolean);

create or replace function public.rug_lens_facets(
  p_location text[] default '{}'::text[],
  p_quality text[] default '{}'::text[],
  p_size text[] default '{}'::text[],
  p_customer_code text[] default '{}'::text[],
  p_item_type text default null::text,
  p_search text default null::text,
  p_include_held_or_assigned boolean default false
)
returns table (locations text[], qualities text[], sizes text[], customer_codes text[])
language sql
stable
set search_path to 'public', 'pg_temp'
as $$
  with base as (
    select current_location, quality, size, customer_no
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
         and (cardinality(p_size) = 0 or size = any(p_size))
         and (cardinality(p_customer_code) = 0 or customer_no = any(p_customer_code))),
      '{}'::text[]
    ) as locations,
    coalesce(
      (select array_agg(distinct btrim(quality)) filter (where quality is not null and btrim(quality) <> '')
       from base
       where (cardinality(p_location) = 0 or current_location = any(p_location))
         and (cardinality(p_size) = 0 or size = any(p_size))
         and (cardinality(p_customer_code) = 0 or customer_no = any(p_customer_code))),
      '{}'::text[]
    ) as qualities,
    coalesce(
      (select array_agg(distinct btrim(size)) filter (where size is not null and btrim(size) <> '')
       from base
       where (cardinality(p_location) = 0 or current_location = any(p_location))
         and (cardinality(p_quality) = 0 or quality = any(p_quality))
         and (cardinality(p_customer_code) = 0 or customer_no = any(p_customer_code))),
      '{}'::text[]
    ) as sizes,
    coalesce(
      (select array_agg(distinct btrim(customer_no)) filter (where customer_no is not null and btrim(customer_no) <> '')
       from base
       where (cardinality(p_location) = 0 or current_location = any(p_location))
         and (cardinality(p_quality) = 0 or quality = any(p_quality))
         and (cardinality(p_size) = 0 or size = any(p_size))),
      '{}'::text[]
    ) as customer_codes;
$$;

revoke all on function public.rug_lens_facets(text[], text[], text[], text[], text, text, boolean) from public;
grant execute on function public.rug_lens_facets(text[], text[], text[], text[], text, text, boolean) to authenticated;
