// Scheduled, server-side ERP sync (build prompt Section 5 — "do not repeat the old
// tool's client-direct call"). Pulls the full NAV/ERP feed
// (https://webapi.jaipurrugs.com/api/ERP/rug-list — no auth, and its own
// salespersonCode/customerCode/limit params are silently ignored, per the build prompt's
// confirmed findings) and upserts into `orders`, keyed on `item_no`. Every app-side read
// then goes through normal RLS-scoped Supabase queries — this is also what actually
// fixes "no server-side filtering," since filtering happens in Postgres afterward, not
// by asking the ERP to filter.
//
// Triggered by db/orders/003_orders_sync_cron.sql's pg_cron job, not by a user JWT — so
// this checks a shared secret header instead of verify_jwt (see supabase/config.toml:
// this function has verify_jwt = false, same posture as guest-signup/employee-signin,
// but for the opposite reason — those are public-safe by design, this one actively
// should NOT be reachable by the public internet, hence the secret check as the very
// first thing this does).
//
// KNOWN OPEN RISK, flagged rather than silently assumed away: the build prompt observed
// this feed at ~120,000 rows / ~145MB. A single Edge Function invocation fetching,
// JSON-parsing, and upserting the whole thing in one shot may exceed Supabase Edge
// Functions' memory/wall-clock limits at that size — this was written against the
// documented behavior, not verified live (this session had no credentials to deploy or
// invoke it). Whoever deploys this should watch the first real run's logs/duration; if
// it doesn't fit in one invocation, the fallback is moving the pull itself (not the
// upsert-into-Postgres design) to a small external scheduled runner that chunks the feed
// into several calls to this function instead of one.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ERP_FEED_URL = "https://webapi.jaipurrugs.com/api/ERP/rug-list";
const BATCH_SIZE = 500;

interface ErpRow {
  [key: string]: unknown;
}

interface StageRow {
  id: string;
  code: string;
}

interface StatusMapRow {
  raw_status: string;
  is_prefix: boolean;
  stage_id: string;
}

function str(row: ErpRow, key: string): string | null {
  const v = row[key];
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function num(row: ErpRow, key: string): number | null {
  const v = row[key];
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function dateOnly(row: ErpRow, key: string): string | null {
  const v = str(row, key);
  if (!v) return null;
  return v.slice(0, 10);
}

function bool(row: ErpRow, key: string): boolean {
  const v = row[key];
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  const s = String(v ?? "").trim().toLowerCase();
  return s === "yes" || s === "y" || s === "true" || s === "1";
}

/** Normalizes whitespace the same way the old tool's stageOf() did, before either exact
 * or prefix matching — the ERP feed is known to carry inconsistent whitespace (including
 * non-breaking space) in Current Status values. */
function normalizeStatus(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

function resolveStageId(
  rawStatus: string | null,
  exactMap: Map<string, string>,
  prefixRules: Array<{ prefix: string; stageId: string }>,
  otherStageId: string | undefined,
): string | undefined {
  if (!rawStatus) return otherStageId;
  const normalized = normalizeStatus(rawStatus);
  const exact = exactMap.get(normalized) ?? exactMap.get(normalized.toLowerCase());
  if (exact) return exact;
  const lc = normalized.toLowerCase();
  // Longest prefix first, so a more specific rule wins over a shorter generic one.
  const sorted = [...prefixRules].sort((a, b) => b.prefix.length - a.prefix.length);
  for (const rule of sorted) {
    if (lc.startsWith(rule.prefix.toLowerCase())) return rule.stageId;
  }
  return otherStageId;
}

function mapErpRowToOrder(row: ErpRow, stageId: string | undefined) {
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const expectedSecret = Deno.env.get("ORDERS_SYNC_SECRET");
  const providedSecret = req.headers.get("x-orders-sync-secret");
  if (!expectedSecret || providedSecret !== expectedSecret) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { data: stages, error: stagesError } = await supabaseAdmin
      .from("stages")
      .select("id, code");
    if (stagesError) throw stagesError;
    const stageByCode = new Map<string, string>((stages as StageRow[]).map((s) => [s.code, s.id]));
    const otherStageId = stageByCode.get("other");

    const { data: statusMap, error: statusMapError } = await supabaseAdmin
      .from("status_stage_map")
      .select("raw_status, is_prefix, stage_id");
    if (statusMapError) throw statusMapError;

    const exactMap = new Map<string, string>();
    const prefixRules: Array<{ prefix: string; stageId: string }> = [];
    for (const row of statusMap as StatusMapRow[]) {
      if (row.is_prefix) {
        prefixRules.push({ prefix: row.raw_status, stageId: row.stage_id });
      } else {
        exactMap.set(row.raw_status, row.stage_id);
        exactMap.set(row.raw_status.toLowerCase(), row.stage_id);
      }
    }

    const erpResponse = await fetch(ERP_FEED_URL);
    if (!erpResponse.ok) {
      throw new Error(`ERP feed returned ${erpResponse.status}`);
    }
    const erpPayload = await erpResponse.json();
    const rows: ErpRow[] = Array.isArray(erpPayload)
      ? erpPayload
      : (erpPayload?.value ?? erpPayload?.data ?? erpPayload?.rows ?? []);

    let upserted = 0;
    let stageEventsInserted = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE).filter((r) => str(r, "Item No_"));
      if (!batch.length) continue;

      const itemNos = batch.map((r) => str(r, "Item No_")!);
      const { data: existing, error: existingError } = await supabaseAdmin
        .from("orders")
        .select("id, item_no, stage_id")
        .in("item_no", itemNos);
      if (existingError) {
        errors.push(`existing lookup batch ${i}: ${existingError.message}`);
        continue;
      }
      const existingByItemNo = new Map((existing ?? []).map((o) => [o.item_no, o]));

      const mappedRows = batch.map((r) => {
        const rawStatus = str(r, "Current Status");
        const stageId = resolveStageId(rawStatus, exactMap, prefixRules, otherStageId);
        return { erp: r, mapped: mapErpRowToOrder(r, stageId) };
      });

      const { data: upsertedRows, error: upsertError } = await supabaseAdmin
        .from("orders")
        .upsert(mappedRows.map((m) => m.mapped), { onConflict: "item_no" })
        .select("id, item_no, stage_id");
      if (upsertError) {
        errors.push(`upsert batch ${i}: ${upsertError.message}`);
        continue;
      }
      upserted += upsertedRows?.length ?? 0;

      const upsertedByItemNo = new Map((upsertedRows ?? []).map((o) => [o.item_no, o]));
      const eventsToInsert: Array<{
        order_id: string;
        stage_id: string;
        entered_at: string;
        source: "erp_sync";
      }> = [];

      for (const { erp, mapped } of mappedRows) {
        if (!mapped.stage_id) continue;
        const upsertedRow = upsertedByItemNo.get(mapped.item_no);
        if (!upsertedRow) continue;
        const previous = existingByItemNo.get(mapped.item_no);

        if (!previous) {
          // First time we've ever seen this order — backfill one event using the ERP's
          // own "days in current status" counter so TAT reporting has a starting point
          // without waiting to observe a live transition.
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
          errors.push(`stage events batch ${i}: ${eventsError.message}`);
        } else {
          stageEventsInserted += eventsToInsert.length;
        }
      }
    }

    return jsonResponse({
      totalRows: rows.length,
      upserted,
      stageEventsInserted,
      errors,
    }, errors.length ? 207 : 200);
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "sync failed" }, 500);
  }
});

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
