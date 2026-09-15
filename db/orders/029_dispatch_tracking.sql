-- Real dispatch status + shipment tracking, from two NAV reports the Rug List view
-- (NAV-002 — what orders-sync.mjs otherwise reads from) doesn't cover at all: a
-- dispatched rug just silently disappears from that view, with no "Dispatched" status
-- text anywhere in it. Confirmed live, 2026-09-15, investigating a real merchant-
-- reported discrepancy — see ERP_AND_EXTERNAL_REQUESTS.md request #9 for the full
-- investigation (Ashish Sharma's manual dispatch count cross-checked exactly against
-- these two reports, row for row).
--
-- New "Dispatched" stage — deliberately NOT reusing the existing `delivered` stage
-- (checked live first: it has zero raw_status mappings today, so it's unused, but
-- "delivered" means the customer actually received it — a later, distinct real-world
-- milestone from "dispatched" — repurposing it would be a naming lie in the data model).
-- is_terminal = true, same as delivered/rejected — this makes it "just work" with
-- private.orders_on_time_status() (024_on_time_status_view.sql), which already treats
-- any is_terminal stage as always on_track, with zero changes needed there.
insert into stages (code, display_name, display_order, is_terminal)
values ('dispatched', 'Dispatched', 55, true)
on conflict (code) do nothing;

-- dispatched_at / sales_shipment_no: from `NAV-011- Posted Whse Shipment Packing List`,
--   keyed by OTN No_ directly.
-- tracking_no / shipping_agent_code / shipping_agent_name / ewb_no: from
--   `View-0462-Sales_Inv_With_AWB_Tracking_And_Bale_Wise_Details`, keyed by Sales Order
--   No + Serial No (that view has no OTN No_ column at all). shipping_agent_name is
--   resolved from NAV's own `JRCPL Live$Shipping Agent` master table at sync time
--   (e.g. code "MH-004" -> "BLUE DART EXPRESS LIMITED") rather than stored as a raw code
--   here, so the UI never needs its own copy of that lookup.
--
-- Deliberately never cleared once set by orders-sync.mjs (see that script's own comment
-- on this) — both source NAV reports only retain a rolling window (confirmed live:
-- NAV-011 ~30 days, View-0462 ~3 months), so a later sync run where an OTN has aged out
-- of either report must NOT be read as "undo the dispatch" — it only means that source
-- no longer has the row, not that the fact stopped being true.
alter table orders
  add column if not exists dispatched_at timestamptz,
  add column if not exists sales_shipment_no text,
  add column if not exists tracking_no text,
  add column if not exists shipping_agent_code text,
  add column if not exists shipping_agent_name text,
  add column if not exists ewb_no text;

comment on column orders.dispatched_at is
  'When this rug''s warehouse shipment was posted in NAV (NAV-011). Set once by orders-sync.mjs, never cleared — NAV-011 only retains ~30 days of history, so absence from a later pull does not mean "not dispatched anymore."';
comment on column orders.tracking_no is
  'Real courier AWB/consignment number from NAV (View-0462), when one exists. Only ~5-9% of shipment lines get a real trackable number — most real-world moves are domestic warehouse transfers via a regional transporter or company vehicle, which never generate one. Null does not mean data is missing; it may genuinely never exist for this rug.';
comment on column orders.shipping_agent_name is
  'Resolved from NAV''s "JRCPL Live$Shipping Agent" master table at sync time (e.g. "BLUE DART EXPRESS LIMITED", "DHL EXPRESS (INDIA) PRIVATE LIMITED", or a small regional transporter''s name) — never a bare code like "MH-004".';
