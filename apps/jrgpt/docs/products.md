# jrgpt.products_mv

**Grain:** one row per design code (65,519). Materialised — refresh after each sync.
**Use for:** product attributes, catalogue questions, design performance when joined to sales.

## Hard limits
- Built from the **order** table, so it covers 2008 onwards — much deeper than sales history.
- Attributes are the **most recent** values seen for that design, not a point-in-time record.

## Columns
| Column | Meaning | Fill |
|---|---|---|
| `design_code` | the key. **Already trimmed** — NAV stores a leading space | 100% |
| `quality` | e.g. `8/8 RWB`, `Tufted` | 100% |
| `construction` | Hand Knotted, Hand Tufted, Dhurrie, Handloom | 99.9% |
| `collection` | **from `India Collection`** | 98.3% |
| `shape`, `product_line`, `item_category` | | 100% |
| `pile_height` | | 95.7% |
| `primary_style` | Modern, Traditional, Transitional | 74.9% |
| `weaving_technique` | | 15.5% |
| `fiber_content` | | 4.8% |
| `sku_count`, `order_lines`, `size_count` | how much it has been made | — |
| `first_ordered`, `last_ordered` | lifespan of the design | — |

## Traps
- The US `Collection` field is only 5% filled and is **deliberately not exposed**. `collection`
  here is `India Collection`. Never report "no collection data".
- `fiber_content` (4.8%) and `weaving_technique` (15.5%) are sparse. Absence is missing data,
  **not** a product without fibre. Say "not recorded", never "none".
- `Care Instruction` is 0% filled in the source and is excluded entirely.
- Design codes in photo filenames look like `JR-ACE-5028 …` — strip the `JR-` prefix and take the
  first whitespace token to join here.

## Examples
```sql
-- Catalogue shape
select construction, count(*) designs from jrgpt.products_mv group by 1 order by 2 desc;

-- Designs that sold exactly once (dead catalogue)
with d as (select design_code, count(*) n from jrgpt.sales_invoiced group by 1)
select count(*) filter (where n=1) sold_once, count(*) total from d;

-- Attributes for a design
select * from jrgpt.products_mv where design_code = 'ESK-632';
```
