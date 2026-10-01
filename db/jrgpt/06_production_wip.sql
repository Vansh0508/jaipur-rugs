-- jrgpt.production_wip : live work-in-progress, one row per rug on the floor.
-- Source: nav_mirror."NAV-331 - Rug List Before Off-Loom" (2008+, full stage-date chain)
-- Answers: what is in production, at what stage, stuck how long, in which cluster.
create or replace view jrgpt.production_wip as
select
  "Production Order No_"                        as production_order_no,
  nullif(btrim("OTN No_"), '')                  as otn_no,
  nullif(btrim("Serial No_"), '')               as serial_no,
  nullif(btrim("Customer No_"), '')             as customer_code,
  nullif(btrim("Current Status"), '')           as current_status,
  nullif(btrim("Production Location"), '')      as production_location,
  nullif(btrim("Weaver Name"), '')              as weaver_name,
  nullif(btrim("QS"), '')                       as quality_supervisor,
  nullif(btrim("Quality"), '')                  as quality,
  nullif(btrim("Design"), '')                   as design_code,
  nullif(btrim("Size"), '')                     as size_code,
  nullif(btrim("Shape"), '')                    as shape_code,
  "Outstanding Quantity"::double precision      as outstanding_qty,
  "Prod_ Cubage"::double precision              as cubage,
  "Order Priority"::int                         as order_priority,
  "Current Staus Pending Days"::int             as days_at_current_status,
  "Actual RPO Creation Date"::date              as rpo_created,
  "Actual MAP Completion Date"::date            as map_completed,
  "Actual Weaver Issue Date"::date              as issued_to_weaver,
  "Actual Branch Issue Date"::date              as issued_to_branch,
  "Order Due Date"::date                        as order_due_date,
  "Rev_Ex Factory"::date                        as revised_ex_factory,
  -- stage durations (null until that stage is reached)
  ("Actual MAP Completion Date"::date - "Actual RPO Creation Date"::date) as days_rpo_to_map,
  ("Actual Weaver Issue Date"::date - "Actual MAP Completion Date"::date) as days_map_to_weaver,
  (current_date - "Actual Weaver Issue Date"::date)                       as days_since_weaver_issue
from nav_mirror."NAV-331 - Rug List Before Off-Loom";

comment on view jrgpt.production_wip is
'Live work in progress, one row per rug before off-loom. days_at_current_status is the stuck-ness signal (24,501 rugs sit over a year). The biggest stage delay is days_map_to_weaver (median 38) which exceeds actual weaving time.';
