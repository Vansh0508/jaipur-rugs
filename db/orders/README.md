# Orders module — plain-language entities (AGENTS.md §3.1, step 1)

Backs `apps/atlas` (the merchant → production → shipping unified order-visibility app —
see `AGENTS.md` §2 and the Module Tracker in `architecture.md`). Source spec:
`TRACKER_REBUILD_PROMPT.md` (parked outside this repo, in the sibling planning folder).

## What this module tracks

- **An order/item** moving through the NAV/ERP production pipeline, from Sales Order
  Date to delivery. One row per ERP `Item No_` (the actual physical rug/carpet unit —
  a single Sales Order can carry several items, each with its own OTN and its own
  progress through the pipeline).
- **The stage it's currently in** (Pre-Loom, Loom, Finishing, ...) and **when it entered
  that stage**, so per-stage TAT (turnaround time) can be computed as a duration, not
  stored as one.
- **Shipping specifics** (weight, dimensions, foldability, carrier quote status) that
  logistics needs to pre-quote large/oversized pieces *before* they're physically ready
  — the specific pain point named in the director meeting.
- **Which external merchant is allowed to see which orders** — replacing the old tool's
  hardcoded `STORE_CUSTOMERS` JS map (and its "unmapped code sees everything" bug) with
  real rows and deny-by-default RLS.

## Entities, in plain language

- **`orders`** — one row per ERP `Item No_`. Mirrors the ERP feed's fields directly
  (see the field-by-field mapping at the bottom of this file) plus a resolved
  `stage_id` (computed from the ERP's free-text `Current Status` via
  `status_stage_map`, not stored redundantly as a name). Upserted by the `orders-sync`
  scheduled function, keyed on `otn_no` + `item_no`. Never written to by any client —
  the sync job is the only writer, via service role.
- **`stages`** — the configurable stage list (Pre-Loom, Loom, Finish, Consignee,
  Purchase, Rejected, Other, seeded from the *validated* buckets already live in the
  old tool's `STATUS_TO_STAGE` table — see Section 2 of the build prompt: the real
  final list is still being decided in a separate meeting, so this is a starting point
  that can be edited by adding/renaming rows, no migration required). Has a
  `display_order` for the timeline UI and an `is_terminal` flag (Rejected/Delivered
  don't accrue "current stage" TAT against the business the same way an in-flight
  stage does).
- **`status_stage_map`** — the actual configurable mapping: one row per *raw* ERP
  `Current Status` value → which `stages` row it resolves to, plus a `fallback_prefix`
  variant for patterns like "Consignee Loc-*" that cover values not seen yet. This
  table, not application code, is what "data-driven stage model" means here — a new
  ERP location name just needs a new row, not a redeploy.
- **`order_stage_events`** — one row per (order, stage, entered_at). TAT per stage is
  *derived* from this (next event's `entered_at` minus this one's, or `now()` if this
  is the order's current stage) — no stored duration column, per spec. The sync job
  inserts a new event only when an order's resolved stage actually changes between
  syncs; on an order's very first sync, it backfills one event using the ERP's own
  `Current Staus Pending Days` counter (`entered_at = now() - pending_days`), so day-one
  TAT reporting doesn't have to wait for a live transition to be observed.
- **`shipping_details`** — one row per order, populated by production/shipping as early
  as they can estimate weight/dimensions/foldability, independent of whether the item
  is physically ready — this is what lets logistics pre-quote instead of waiting.
- **`merchants`** — an external party (a store/customer contact, possibly representing
  several ERP `Customer No_` codes — e.g. the old tool's `7333` login covered ten
  different customer codes across Dubai/Milan/Singapore/London). Linked to a Clerk
  user only after that person actually signs in and their email matches a pre-seeded
  row — never auto-created from an unrecognized sign-in.
- **`merchant_customer_codes`** — junction table: which ERP `Customer No_` codes a
  merchant can see. Directly replaces `STORE_CUSTOMERS`; RLS reads this table, and an
  unmapped/empty result means **zero rows**, not "no restriction."
- **`employees.salesperson_code`** (extension, not a new table) — nullable, unique.
  Lets a Sales-role employee's own row be matched against `orders.salesperson_code`,
  the same scoping the old tool did by login code. Extending the existing shared
  `employees` table rather than a parallel table, same precedent as the journeys
  module extending `vehicles`/`drivers`.

## Roles (reusing the existing employees / department_access_grants foundation)

- **admin** — permission key `orders.read.all` / `orders.write.all` (added to the
  existing `permissions` table, same pattern as `employees.write` etc.) — sees and can
  correct anything.
- **production**, **shipping**, **sales** — department-scoped via the *existing*
  `department_access_grants` table (no new access model invented): an employee with a
  grant on the `production` or `shipping` department can read all orders and write to
  the fields their department owns (`shipping_details` for shipping; stage-correction
  for production, via `orders-update-stage`, in the rare case the ERP-resolved stage
  needs manual override). A `sales` grant additionally can only be *scoped down further*
  to their own `salesperson_code` if the org later wants per-rep restriction — Phase 1
  ships department-wide read for internal roles (the director's ask is one shared page
  for merchant/production/shipping/sales, not a re-litigation of who-sees-what
  internally) and salesperson-scoped by default when no department grant exists.
- **merchant** — external, Clerk-authenticated (see `AGENTS.md`'s recorded override on
  this — Section 1). Rows scoped to `orders.customer_no` via `merchant_customer_codes`.

## ERP field mapping (`orders` columns ← NAV `rug-list` feed)

Confirmed against a live sample pull (`customer_34836_orders.json`, 110 real rows) and
every field the old tool (`track-jr-order.html`) actually reads — this is the "pull the
old tool's source for field mappings before finalizing the schema" step from the
migration checklist.

| ERP field | `orders` column |
|---|---|
| `OTN No_` | `otn_no` |
| `Item No_` | `item_no` (unique key together with `otn_no`) |
| `Sales Order No_` | `sales_order_no` |
| `Customer No_` | `customer_no` |
| `Customer PO No_` | `customer_po_no` |
| `Merchant Name` | `merchant_name` |
| `Current Status` | `raw_current_status` (resolved to `stage_id` via `status_stage_map`) |
| `Current Staus Pending Days` (sic, ERP typo kept only in the source column name) | `current_status_pending_days` |
| `Quality` | `quality` |
| `Design` | `design` |
| `Size` / `Size In Cm` | `size`, `size_cm` |
| `Shape` | `shape` |
| `On Hold` | `on_hold` |
| `Quick Ship` | `quick_ship` |
| `Order Priority` | `order_priority` |
| `Order Wise Merchant` | `order_wise_merchant` |
| `Rev_Ex Factory` / `Original Ex Factory` | `revised_ex_factory_date`, `original_ex_factory_date` |
| `Promised Delivery Date` | `promised_delivery_date` |
| `Expected Ready Date` | `expected_ready_date` |
| `Sales Order Date` | `sales_order_date` |
| `Salesperson Code` / `Sales Person Code` (ERP has both spellings in the wild) | `salesperson_code` |
| `Construction` | `construction` |
| `India Collection` | `india_collection` |
| `Pile Fibre` | `pile_fibre` |
| `Pile Height` | `pile_height` |
| `GR Color Name` / `BR Color Name` | `gr_color_name`, `br_color_name` |
| `Matching Code` | `matching_code` |
| `Backing` | `backing` |
| `Std Cubage` | `std_cubage` |
| `Follow Up Person` | `follow_up_person` (mapped/displayed only — no ownership model built, per spec) |
| `Project Coodinator` (sic) | `project_coordinator` |
| `Production Order No_` | `production_order_no` |
| `Production Order Status` | `production_order_status` |
| `Item Description` | `item_description` |
| `Serial No_` | `serial_no` |
| `US Item Code` | `us_item_code` |
| `Warehouse Shipment Created` | `warehouse_shipment_created` |
| `Remark` | `remark` |
| `Authorization` | `authorization` |

See `orders-schema.mmd` for the ERD.
