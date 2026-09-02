// Standalone ERP sync — runs as a plain Node process on the real server (via a system
// cron entry there), NOT as a Supabase Edge Function.
//
// History: this used to be supabase/functions/orders-sync/index.ts, triggered every 30
// minutes by a pg_cron job (db/orders/003_orders_sync_cron.sql). Confirmed 2026-09-02:
// even after rewriting that function to stream-parse the feed instead of buffering it
// whole, a real run against the live ~120,000-row / ~145MB feed still failed with
// WORKER_RESOURCE_LIMIT — twice, at a near-identical ~9.5s mark. Edge Functions are
// sized for light request/response work, not pulling and mapping a feed this size in
// one call. This script does the exact same job (same table writes, same mapping
// rules) but as an ordinary Node process on a real machine, which has no such ceiling —
// so it just reads the whole feed into memory in one shot; no streaming parser needed.
// See db/orders/007_orders_sync_move_to_server.sql for the migration that un-schedules
// the old pg_cron job.
//
// Run manually:
//   cd apps/atlas && node --env-file=.env.local scripts/orders-sync.mjs
// Scheduled via a Linux cron entry on the server (see deploy notes in architecture.md),
// not pg_cron — nothing in Postgres calls this anymore.
//
// Needs, in apps/atlas/.env.local on the server (NOT committed to git):
//   NEXT_PUBLIC_SUPABASE_URL         (already there for the Next.js app)
//   SUPABASE_SERVICE_ROLE_KEY        (server-only — bypasses RLS the same way the old
//                                     Edge Function's built-in service role did; get it
//                                     from the Supabase Dashboard's Project Settings ->
//                                     API page, "service_role" secret)

import { createClient } from "@supabase/supabase-js";

const ERP_FEED_URL = "https://webapi.jaipurrugs.com/api/ERP/rug-list";
const BATCH_SIZE = 500;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment.");
  process.exit(1);
}
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

function str(row, key) {
  const v = row[key];
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function num(row, key) {
  const v = row[key];
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Confirmed 2026-09-02 on the real feed: date-ish fields sometimes hold plain status
// text instead of a date (e.g. "Ready" in Expected Ready Date, presumably meaning "no
// date yet, it's just ready") — Postgres rejects that outright for a `date` column.
// Only pass through something that actually looks like a date; anything else becomes
// null rather than failing the whole batch's upsert.
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
function dateOnly(row, key) {
  const v = str(row, key);
  if (!v) return null;
  const candidate = v.slice(0, 10);
  return DATE_ONLY_RE.test(candidate) ? candidate : null;
}

function bool(row, key) {
  const v = row[key];
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  const s = String(v ?? "").trim().toLowerCase();
  return s === "yes" || s === "y" || s === "true" || s === "1";
}

/** Same normalization as the old Edge Function — the ERP feed carries inconsistent
 * whitespace (including non-breaking space) in Current Status values. */
function normalizeStatus(raw) {
  return raw.replace(/\s+/g, " ").trim();
}

function resolveStageId(rawStatus, exactMap, prefixRules, otherStageId) {
  if (!rawStatus) return otherStageId;
  const normalized = normalizeStatus(rawStatus);
  const exact = exactMap.get(normalized) ?? exactMap.get(normalized.toLowerCase());
  if (exact) return exact;
  const lc = normalized.toLowerCase();
  const sorted = [...prefixRules].sort((a, b) => b.prefix.length - a.prefix.length);
  for (const rule of sorted) {
    if (lc.startsWith(rule.prefix.toLowerCase())) return rule.stageId;
  }
  return otherStageId;
}

function mapErpRowToOrder(row, stageId) {
  return {
    otn_no: str(row, "OTN No_") ?? "",
    item_no: str(row, "Item No_") ?? "",
    sales_order_no: str(row, "Sales Order No_"),
    serial_no: str(row, "Serial No_"),
    production_order_no: str(row, "Production Order No_"),
    customer_no: str(row, "Customer No_"),
    merchant_name: str(row, "Merchant Name"),
    order_wise_merchant: str(row, "Order Wise Merchant"),
    customer_po_no: str(row, "Customer PO No_"),
    salesperson_code: str(row, "Salesperson Code") ?? str(row, "Sales Person Code"),
    raw_current_status: str(row, "Current Status"),
    stage_id: stageId ?? null,
    current_status_pending_days:
      num(row, "Current Staus Pending Days") ?? num(row, "Current Status Pending Days"),
    production_order_status: str(row, "Production Order Status"),
    on_hold: str(row, "On Hold"),
    order_priority: num(row, "Order Priority"),
    authorization: str(row, "Authorization"),
    remark: str(row, "Remark"),
    quality: str(row, "Quality"),
    design: str(row, "Design"),
    size: str(row, "Size"),
    size_cm: str(row, "Size In Cm"),
    shape: str(row, "Shape"),
    construction: str(row, "Construction"),
    india_collection: str(row, "India Collection"),
    pile_fibre: str(row, "Pile Fibre"),
    pile_height: str(row, "Pile Height"),
    gr_color_name: str(row, "GR Color Name"),
    br_color_name: str(row, "BR Color Name"),
    matching_code: str(row, "Matching Code"),
    backing: str(row, "Backing"),
    std_cubage: num(row, "Std Cubage"),
    item_description: str(row, "Item Description"),
    us_item_code: str(row, "US Item Code"),
    quick_ship: bool(row, "Quick Ship"),
    warehouse_shipment_created: bool(row, "Warehouse Shipment Created"),
    sales_order_date: dateOnly(row, "Sales Order Date"),
    revised_ex_factory_date: dateOnly(row, "Rev_Ex Factory"),
    original_ex_factory_date: dateOnly(row, "Original Ex Factory"),
    promised_delivery_date: dateOnly(row, "Promised Delivery Date"),
    expected_ready_date: dateOnly(row, "Expected Ready Date"),
    follow_up_person: str(row, "Follow Up Person"),
    project_coordinator: str(row, "Project Coodinator"),
    erp_synced_at: new Date().toISOString(),
  };
}

async function processBatch(batch, stageState, counters, errors, batchIndex) {
  if (!batch.length) return;
  const label = batchIndex;

  // Confirmed 2026-09-02 on the real feed: the same Item No_ can appear more than once
  // within a single batch. A single upsert() call can't target the same conflict row
  // twice ("ON CONFLICT DO UPDATE command cannot affect row a second time"), so collapse
  // to one row per item number before doing anything else. "Last occurrence in feed
  // order wins" is a simplification — nothing in the feed says which duplicate is more
  // authoritative.
  const dedupedByItemNo = new Map();
  for (const r of batch) {
    const itemNo = str(r, "Item No_");
    dedupedByItemNo.set(itemNo, r);
  }
  const dedupedBatch = Array.from(dedupedByItemNo.values());

  const itemNos = dedupedBatch.map((r) => str(r, "Item No_"));
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("orders")
    .select("id, item_no, stage_id")
    .in("item_no", itemNos);
  if (existingError) {
    errors.push(`existing lookup batch ${label}: ${existingError.message}`);
    return;
  }
  const existingByItemNo = new Map((existing ?? []).map((o) => [o.item_no, o]));

  const { exactMap, prefixRules, otherStageId } = stageState;
  const mappedRows = dedupedBatch.map((r) => {
    const rawStatus = str(r, "Current Status");
    const stageId = resolveStageId(rawStatus, exactMap, prefixRules, otherStageId);
    return { erp: r, mapped: mapErpRowToOrder(r, stageId) };
  });

  const { data: upsertedRows, error: upsertError } = await supabaseAdmin
    .from("orders")
    .upsert(mappedRows.map((m) => m.mapped), { onConflict: "item_no" })
    .select("id, item_no, stage_id");
  if (upsertError) {
    errors.push(`upsert batch ${label}: ${upsertError.message}`);
    return;
  }
  counters.upserted += upsertedRows?.length ?? 0;

  const upsertedByItemNo = new Map((upsertedRows ?? []).map((o) => [o.item_no, o]));
  const eventsToInsert = [];

  for (const { mapped } of mappedRows) {
    if (!mapped.stage_id) continue;
    const upsertedRow = upsertedByItemNo.get(mapped.item_no);
    if (!upsertedRow) continue;
    const previous = existingByItemNo.get(mapped.item_no);

    if (!previous) {
      const pendingDays = mapped.current_status_pending_days ?? 0;
      const enteredAt = new Date(Date.now() - pendingDays * 24 * 60 * 60 * 1000).toISOString();
      eventsToInsert.push({
        order_id: upsertedRow.id,
        stage_id: mapped.stage_id,
        entered_at: enteredAt,
        source: "erp_sync",
      });
    } else if (previous.stage_id !== mapped.stage_id) {
      eventsToInsert.push({
        order_id: upsertedRow.id,
        stage_id: mapped.stage_id,
        entered_at: new Date().toISOString(),
        source: "erp_sync",
      });
    }
  }

  if (eventsToInsert.length) {
    const { error: eventsError } = await supabaseAdmin
      .from("order_stage_events")
      .upsert(eventsToInsert, { onConflict: "order_id,stage_id,entered_at", ignoreDuplicates: true });
    if (eventsError) {
      errors.push(`stage events batch ${label}: ${eventsError.message}`);
    } else {
      counters.stageEventsInserted += eventsToInsert.length;
    }
  }
}

async function main() {
  const startedAt = Date.now();

  const { data: stages, error: stagesError } = await supabaseAdmin.from("stages").select("id, code");
  if (stagesError) throw stagesError;
  const stageByCode = new Map(stages.map((s) => [s.code, s.id]));
  const otherStageId = stageByCode.get("other");

  const { data: statusMap, error: statusMapError } = await supabaseAdmin
    .from("status_stage_map")
    .select("raw_status, is_prefix, stage_id");
  if (statusMapError) throw statusMapError;

  const exactMap = new Map();
  const prefixRules = [];
  for (const row of statusMap) {
    if (row.is_prefix) {
      prefixRules.push({ prefix: row.raw_status, stageId: row.stage_id });
    } else {
      exactMap.set(row.raw_status, row.stage_id);
      exactMap.set(row.raw_status.toLowerCase(), row.stage_id);
    }
  }
  const stageState = { exactMap, prefixRules, otherStageId };

  console.log(`[orders-sync] fetching ${ERP_FEED_URL} ...`);
  const erpResponse = await fetch(ERP_FEED_URL);
  if (!erpResponse.ok) throw new Error(`ERP feed returned ${erpResponse.status}`);
  const rows = await erpResponse.json();
  console.log(`[orders-sync] fetched ${rows.length} rows, upserting in batches of ${BATCH_SIZE} ...`);

  const counters = { upserted: 0, stageEventsInserted: 0 };
  const errors = [];
  let batchIndex = 0;
  let pendingBatch = [];

  for (const row of rows) {
    if (!str(row, "Item No_")) continue;
    pendingBatch.push(row);
    if (pendingBatch.length >= BATCH_SIZE) {
      await processBatch(pendingBatch, stageState, counters, errors, batchIndex++);
      pendingBatch = [];
    }
  }
  await processBatch(pendingBatch, stageState, counters, errors, batchIndex++);

  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(
    `[orders-sync] done in ${seconds}s — totalRows=${rows.length} upserted=${counters.upserted} stageEventsInserted=${counters.stageEventsInserted} errors=${errors.length}`,
  );
  if (errors.length) {
    console.error("[orders-sync] errors:", errors.slice(0, 20));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[orders-sync] fatal:", err instanceof Error ? err.message : err);
  process.exit(1);
});
