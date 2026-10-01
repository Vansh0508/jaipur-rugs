-- jrgpt.open_orders : orders taken but not yet invoiced (the cash pipeline).
-- Source: nav_mirror."NAV-062 - Customer Open Order Value Report"
-- Traps handled: "Type of Business" excluded (6.9% filled); ageing_band kept as the
--   pre-computed NAV text band; line_amount_inr is already INR.
create or replace view jrgpt.open_orders as
select
  "Sales Order No_"                        as sales_order_no,
  "Sales Line No_"::int                    as sales_line_no,
  "Sales Order Date"::date                 as sales_order_date,
  "First Order Date"::date                 as first_order_date,
  nullif(btrim("Customer No_"), '')        as customer_code,
  nullif(btrim("Customer Name"), '')       as customer_name,
  nullif(btrim("Customer Classification"),'') as customer_classification,
  nullif(btrim("Merchant Name"), '')       as merchant,
  nullif(btrim("Country"), '')             as country,
  nullif(btrim("Customer Service Zone"),'')as service_zone,
  nullif(btrim("Territory Head"), '')      as territory_head,
  nullif(btrim("Design"), '')              as design_code,
  nullif(btrim("Quality"), '')             as quality,
  nullif(btrim("Size"), '')                as size_code,
  "Outstanding Quantity"::double precision as outstanding_qty,
  "Sq. Feet"::double precision             as sqft,
  "Line Amount INR"::double precision      as line_amount_inr,
  nullif(btrim("Order Ageing"), '')        as ageing_band,
  nullif(btrim("Current Status"), '')      as current_status,
  nullif(btrim("Status Grouping"), '')     as status_grouping,
  (current_date - "Sales Order Date"::date) as days_since_order
from nav_mirror."NAV-062 - Customer Open Order Value Report";

comment on view jrgpt.open_orders is
'Open (uninvoiced) order book. line_amount_inr is already INR. ageing_band is NAV pre-computed text (<60, 61-120, 121-180, 181-365, 1Yr - 2Yrs, >2 Yrs) - use days_since_order for numeric cuts.';
