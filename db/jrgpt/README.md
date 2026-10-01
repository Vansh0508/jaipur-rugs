# db/jrgpt

Curated read-only views over the NAV mirror (`nav_mirror` schema on 192.168.0.18), which is
a **different Postgres** from the shared Supabase project the other modules migrate.

These exist because pointing anything — a person or a model — at the raw 90 mirrored NAV
tables produces confident wrong answers. Each view drops the traps and renames columns to
what they actually mean. The traps are documented per-view in `apps/jrgpt/docs/`.

Apply in numeric order. `05_materialize.sql` must run after 03 and 04.

| File | Creates |
|---|---|
| `01_sales_invoiced.sql` | `jrgpt.sales_invoiced` — invoiced sales, INR-normalised |
| `02_open_orders.sql` | `jrgpt.open_orders` — the open order book |
| `03_customers.sql` | `jrgpt.customers` — per-customer lifetime + reorder behaviour |
| `04_products.sql` | `jrgpt.products` — one row per design |
| `05_materialize.sql` | `products_mv`, `customers_mv` (12.3s → 0.19s) |
| `06_production_wip.sql` | `jrgpt.production_wip` — live WIP with stage dates |
| `07_artisans.sql` | `jrgpt.artisan_activity` — weaver/branch output |
| `08_receivables.sql` | `jrgpt.receivables` — open receivables |
| `09_fg_stock.sql` | `jrgpt.fg_stock` — finished rugs with ageing |

**Refresh:** the two materialised views go stale when the mirror re-syncs.
`Tableau/jrgpt/refresh_jrgpt.sh` refreshes them concurrently.

**Not here on purpose:** the NAV→mirror copy scripts and the answer key live in the Tableau
working directory. They are sync and verification infrastructure, not application code.
