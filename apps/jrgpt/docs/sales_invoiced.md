# jrgpt.sales_invoiced

**Grain:** one row per invoice line (one rug, or a quantity of one item, on one invoice).
**Use for:** revenue, what sold, to whom, where, at what price.
**Do not use for:** orders not yet shipped (use `jrgpt.open_orders`), cost or margin (we hold none).

## Hard limits — state these in the answer
- **History starts 2021-04-01.** The NAV source is a rolling ~5-year window; older years drop off.
  Never claim the business began then. For longer history use the order-side table.
- **No cost data exists.** Margin and profitability cannot be computed. Say so plainly.
- **30.5% of revenue is to the group's own entities** (`is_related_party`). Any concentration,
  churn or customer-count answer must say whether they are in or out.

## Columns
| Column | Meaning |
|---|---|
| `invoice_date`, `order_date` | dates; lead time = invoice_date − order_date |
| `financial_year` | Indian FY as text, e.g. `25-26`. Use this, not calendar year |
| `customer_code`, `customer_name` | the buyer |
| `customer_classification` | e.g. Carpet Wholesaler |
| `country`, `territory` | destination |
| `is_big_box` | boolean — the reliable channel flag |
| `is_related_party` | **true for Jaipur Living / Jaipur Rugs entities / Shyam Ahuja** |
| `merchant`, `salesperson_code` | who sold it |
| `design_code`, `quality`, `size_code`, `shape_code`, `collection` | product |
| `item_code`, `serial_no` | the individual rug |
| `quantity`, `sold_sqft` | volume |
| **`amount_inr`** | **revenue, INR-normalised. The only correct revenue column.** |
| `net_amount`, `unit_price_psf` | after discount; price per sq ft |
| `currency_code` | original currency (86% non-INR) — informational only |

## Traps
- Never sum `Amount` from the raw table — it is foreign currency. `amount_inr` is already converted.
- `unit_price_psf` is dirty: std-dev exceeds the mean, max ₹66,420/sq ft. Use medians, exclude outliers.
- `collection` is ~73% filled. Absence is not evidence the rug has no collection.
- There is no B2B/B2C flag. The raw `Type_of_Business` is `-` on 96.9% of rows and is excluded.
  Use `is_big_box` and `customer_classification` instead.

## Examples
```sql
-- Revenue by financial year
select financial_year, round((sum(amount_inr)/10000000)::numeric,1) as cr_inr
from jrgpt.sales_invoiced group by 1 order by 1;

-- External revenue only (exclude own group)
select round((sum(amount_inr)/10000000)::numeric,1) as cr_inr
from jrgpt.sales_invoiced where not is_related_party;

-- Top designs this financial year
select design_code, round((sum(amount_inr)/10000000)::numeric,2) as cr_inr, sum(quantity) rugs
from jrgpt.sales_invoiced where financial_year='25-26' group by 1 order by 2 desc limit 10;

-- Median order-to-invoice lead time
select round(percentile_cont(0.5) within group (order by (invoice_date-order_date))::numeric,0)
from jrgpt.sales_invoiced where order_date is not null and invoice_date >= order_date;
```
