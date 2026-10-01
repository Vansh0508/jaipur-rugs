# jrgpt.customers_mv

**Grain:** one row per customer. Materialised — refresh after each sync.
**Use for:** who is growing, who is quiet, repeat behaviour, concentration, whitespace.

## Hard limits
- Derived from `jrgpt.sales_invoiced`, so it inherits the **2021-04-01 history floor**. A customer
  who last bought in 2019 simply is not here. Never call that customer "lost" — we cannot see them.
- `first_invoice_date` is the first invoice **in the window**, not the customer's true first order.
  For genuine first-order dates use the order-side table.

## Columns
| Column | Meaning |
|---|---|
| `customer_code`, `customer_name`, `customer_classification` | identity |
| `country`, `territory` | geography |
| `ever_big_box` | bought through the Big Box channel at any point |
| `first_invoice_date`, `last_invoice_date` | bounded by the window |
| `days_since_last_order` | the churn signal |
| `invoice_lines`, `active_months` | activity. `active_months > 1` = a genuine repeat customer |
| `distinct_designs_bought`, `distinct_collections_bought` | breadth — the whitespace signal |
| `lifetime_amount_inr` | total spend in the window |
| `avg_reorder_gap_days` | their own normal cycle |

## Traps
- **Quiet ≠ churned.** A customer whose normal cycle is 400 days is not at risk at 200 days. Always
  compare `days_since_last_order` against that customer's own `avg_reorder_gap_days`.
- A naive "2× normal cycle" rule flags 93% of customers. Use an absolute floor too (e.g. 365 days)
  and a value floor, or the list is useless.
- Group entities are in here. Exclude via `sales_invoiced.is_related_party` when reporting
  concentration or customer counts.

## Examples
```sql
-- Big customers gone quiet over a year
select customer_name, round((lifetime_amount_inr/10000000)::numeric,1) cr, days_since_last_order
from jrgpt.customers_mv
where days_since_last_order > 365 and lifetime_amount_inr >= 10000000
order by lifetime_amount_inr desc;

-- Repeat rate
select count(*) customers, count(*) filter (where active_months > 1) repeated
from jrgpt.customers_mv;

-- Whitespace: big spenders buying few collections
select customer_name, distinct_collections_bought, round((lifetime_amount_inr/10000000)::numeric,1) cr
from jrgpt.customers_mv where lifetime_amount_inr > 50000000 and distinct_collections_bought <= 2
order by lifetime_amount_inr desc;
```
