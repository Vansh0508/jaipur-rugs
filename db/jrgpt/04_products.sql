-- jrgpt.products : one row per design, with attributes.
-- Source: nav_mirror."NAV-033 - Total Order Rug List" (order grain, 2008+).
-- Traps handled: design codes carry a LEADING SPACE in NAV - trimmed here;
--   "Collection" is only 5% filled so "India Collection" is used as collection;
--   "Care Instruction" is 0% filled and is excluded.
create or replace view jrgpt.products as
with src as (
  select upper(btrim("Design")) as design_code,
         "Quality" q, "Construction" cons, "India Collection" coll, "Shape" shape,
         "Product Line Category" pl, "Primary Style" style, "Weaving Technique" weave,
         "Fiber Content" fiber, "Pile Height" pile, "Item Category Code" cat,
         "Sales Order Date" sod,
         row_number() over (partition by upper(btrim("Design"))
                            order by "Sales Order Date" desc nulls last) rn
  from nav_mirror."NAV-033 - Total Order Rug List"
  where "Design" is not null and btrim("Design") <> ''),
agg as (
  select upper(btrim("Design")) as design_code,
         count(*)                          as order_lines,
         count(distinct "Item No_")        as sku_count,
         count(distinct "Size")            as size_count,
         min("Sales Order Date")::date     as first_ordered,
         max("Sales Order Date")::date     as last_ordered
  from nav_mirror."NAV-033 - Total Order Rug List"
  where "Design" is not null and btrim("Design") <> ''
  group by 1)
select s.design_code,
       nullif(btrim(s.q), '')     as quality,
       nullif(btrim(s.cons), '')  as construction,
       nullif(btrim(s.coll), '')  as collection,
       nullif(btrim(s.shape), '') as shape,
       nullif(btrim(s.pl), '')    as product_line,
       nullif(btrim(s.style), '') as primary_style,
       nullif(btrim(s.weave), '') as weaving_technique,
       nullif(btrim(s.fiber), '') as fiber_content,
       nullif(btrim(s.pile), '')  as pile_height,
       nullif(btrim(s.cat), '')   as item_category,
       a.sku_count, a.order_lines, a.size_count, a.first_ordered, a.last_ordered
from src s join agg a using (design_code)
where s.rn = 1;

comment on view jrgpt.products is
'One row per design (65k+). collection comes from "India Collection" (98% filled); the US "Collection" field is 5% filled and deliberately omitted. fiber_content and weaving_technique are sparse - do not report absence as fact.';
