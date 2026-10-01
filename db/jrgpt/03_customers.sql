-- jrgpt.customers : one row per customer, with lifetime behaviour.
-- Derived from jrgpt.sales_invoiced. Reorder gap and quiet-account detection live here.
create or replace view jrgpt.customers as
with o as (
  select customer_code, customer_name, customer_classification, country, territory,
         invoice_date, amount_inr, design_code, collection, is_big_box
  from jrgpt.sales_invoiced
  where customer_code is not null),
gaps as (
  select customer_code,
         avg(invoice_date - prev_date) as avg_reorder_gap_days,
         count(*) filter (where prev_date is not null) as repeat_events
  from (select customer_code, invoice_date,
               lag(invoice_date) over (partition by customer_code order by invoice_date) prev_date
        from (select distinct customer_code, invoice_date from o) d) g
  where prev_date is null or invoice_date > prev_date
  group by 1)
select
  o.customer_code,
  max(o.customer_name)                                  as customer_name,
  max(o.customer_classification)                        as customer_classification,
  max(o.country)                                        as country,
  max(o.territory)                                      as territory,
  bool_or(o.is_big_box)                                 as ever_big_box,
  min(o.invoice_date)                                   as first_invoice_date,
  max(o.invoice_date)                                   as last_invoice_date,
  (current_date - max(o.invoice_date))                  as days_since_last_order,
  count(*)                                              as invoice_lines,
  count(distinct date_trunc('month', o.invoice_date))   as active_months,
  count(distinct o.design_code)                         as distinct_designs_bought,
  count(distinct o.collection)                          as distinct_collections_bought,
  sum(o.amount_inr)                                     as lifetime_amount_inr,
  max(g.avg_reorder_gap_days)                           as avg_reorder_gap_days
from o left join gaps g on g.customer_code = o.customer_code
group by o.customer_code;

comment on view jrgpt.customers is
'One row per customer with lifetime totals and reorder behaviour. days_since_last_order vs avg_reorder_gap_days identifies quiet/at-risk accounts. Dates are bounded by the rolling window of jrgpt.sales_invoiced.';
