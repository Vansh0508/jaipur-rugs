-- jrgpt.sales_invoiced : invoiced sales, one row per invoice line.
-- Source: nav_mirror."View-0077Z-FULL Sold-Carpet-Report"
-- Traps handled: amount_inr uses "Amount (LCY)" (INR-normalised) NOT "Amount" (foreign currency);
--   "Type_of_Business" excluded entirely (96.9% literal '-'); design_code trimmed.
-- Caveat: this source is a ROLLING ~5-year window. Do not claim history before min(invoice_date).
create schema if not exists jrgpt;

create or replace view jrgpt.sales_invoiced as
select
  "Invoice Date"::date                     as invoice_date,
  "Order Date"::date                       as order_date,
  "INV-FY"                                 as financial_year,
  nullif(btrim("SellToCust#"), '')         as customer_code,
  nullif(btrim("Sell-to Customer Name"),'')as customer_name,
  nullif(btrim("Customer Classification"),'') as customer_classification,
  nullif(btrim("CountryName"), '')         as country,
  nullif(btrim("Territory_Name"), '')      as territory,
  case when "IsBigBox" = 'Yes' then true else false end as is_big_box,
  nullif(btrim("Merchant Name"), '')       as merchant,
  nullif(btrim("SPCode"), '')              as salesperson_code,
  nullif(btrim("Design Code"), '')         as design_code,
  nullif(btrim("Quality"), '')             as quality,
  nullif(btrim("Size Code"), '')           as size_code,
  nullif(btrim("Shape Code"), '')          as shape_code,
  nullif(btrim("Collection Name"), '')     as collection,
  nullif(btrim("ItemCode"), '')            as item_code,
  nullif(btrim("Serial No."), '')          as serial_no,
  "Quantity"::double precision             as quantity,
  "Sold Area Sq. Feet"::double precision   as sold_sqft,
  "Amount (LCY)"::double precision         as amount_inr,
  "Net Amount"::double precision           as net_amount,
  "Unit Price Per Sq.Ft."::double precision as unit_price_psf,
  nullif(btrim("Currency Code"), '')       as currency_code,
  -- Related-party flag. ~29% of invoiced "revenue" is to the group's own
  -- distribution arms / sister brands, not to external customers. Any
  -- concentration, churn or customer-count answer MUST be able to exclude these.
  -- Heuristic on name - CONFIRM THE LIST WITH FINANCE before treating as final.
  (   "Sell-to Customer Name" ilike '%jaipur living%'
   or "Sell-to Customer Name" ilike '%jaipur rugs%'
   or "Sell-to Customer Name" ilike '%shyam ahuja%')      as is_related_party
from nav_mirror."View-0077Z-FULL Sold-Carpet-Report"
where "Invoice Date" is not null;

comment on view jrgpt.sales_invoiced is
'Invoiced rug sales, one row per invoice line. amount_inr is INR-normalised and is the ONLY correct revenue column. Rolling ~5-year window - check min(invoice_date) before making historical claims. No cost data exists, so margin cannot be computed.';
