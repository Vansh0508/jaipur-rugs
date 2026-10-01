# jrgpt.open_orders

**Grain:** one row per open sales-order line — ordered, not yet invoiced.
**Use for:** the order book, cash pipeline, what is stuck, ageing.
**Do not use for:** anything already shipped (use `jrgpt.sales_invoiced`).

## Hard limits
- This is a **live snapshot**, not history. It shows what is open *now*; it cannot show what the
  book looked like last March.
- `line_amount_inr` is already INR. Do not convert.

## Columns
| Column | Meaning |
|---|---|
| `sales_order_no`, `sales_line_no` | order identity |
| `sales_order_date`, `first_order_date` | when ordered; customer's first ever order |
| `customer_code`, `customer_name`, `customer_classification` | the buyer |
| `merchant`, `country`, `service_zone`, `territory_head` | ownership and geography |
| `design_code`, `quality`, `size_code` | product |
| `outstanding_qty`, `sqft` | what is still owed |
| **`line_amount_inr`** | **value of the open line, in INR** |
| `ageing_band` | NAV's own text band: `<60`, `61-120`, `121-180`, `181-365`, `1Yr - 2Yrs`, `>2 Yrs` |
| `days_since_order` | numeric age — use this for custom cuts |
| `current_status`, `status_grouping` | where it is (Under Production, Ready + Finishing, Others) |

## Traps
- `ageing_band` is **text**, not a number. Sorting it alphabetically is wrong. Use
  `days_since_order` for numeric thresholds, `ageing_band` only when echoing NAV's own buckets.
- `Type of Business` is excluded — 6.9% filled in the source.
- `merchant` is ~69% filled; unattributed value is real, not zero.

## Examples
```sql
-- Total open book
select round((sum(line_amount_inr)/10000000)::numeric,1) as cr_inr from jrgpt.open_orders;

-- Stuck more than 6 months
select round((sum(line_amount_inr)/10000000)::numeric,1) as cr_inr, count(*) lines
from jrgpt.open_orders where days_since_order > 180;

-- By stage
select status_grouping, count(*) lines, round((sum(line_amount_inr)/10000000)::numeric,1) cr_inr
from jrgpt.open_orders group by 1 order by 3 desc;
```
