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
// RESOLVED 2026-09-02 (was flagged here as an open risk, then confirmed): the feed is
// ~120,000 rows / ~145MB, and the first real invocation hit WORKER_RESOURCE_LIMIT trying
// to buffer + JSON.parse the whole response at once. Fixed by reading the response as a
// stream and parsing one row at a time (see RowStreamer below) instead of moving the
// pull to a separate external runner — the upsert-into-Postgres design didn't need to
// change, only how the feed gets read.

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

// Confirmed 2026-09-02 (see this file's own "KNOWN OPEN RISK" comment — no longer open):
// `await response.json()` on the full ~145MB feed hit WORKER_RESOURCE_LIMIT on the very
// first real invocation. The feed is a plain top-level JSON array of flat objects
// (confirmed by sampling the first few KB live) — RowStreamer reads the response as it
// arrives and emits one row at a time, so peak memory is proportional to one network
// chunk plus one row, never the whole feed. Hand-rolled rather than an npm streaming-JSON
// library, specifically to avoid depending on something unverified inside a Deno edge
// runtime for a fix that only needs "track string state and bracket depth."
class RowStreamer {
  private buf = "";
  private depth = 0; // 0 = between rows; >0 = inside the current row object
  private inString = false;
  private escapeNext = false;
  private rowStart = -1; // index into `buf` where the current row's `{` began
  private started = false; // seen the feed's outer `[` yet
  private finished = false; // seen the feed's outer `]` yet

  feed(chunk: string): ErpRow[] {
    this.buf += chunk;
    const rows: ErpRow[] = [];
    let i = 0;

    while (i < this.buf.length && !this.finished) {
      const c = this.buf[i];

      if (!this.started) {
        if (c === "[") this.started = true;
        i++;
        continue;
      }

      if (this.depth === 0) {
        if (c === "{") {
          this.rowStart = i;
          this.depth = 1;
        } else if (c === "]") {
          this.finished = true;
        }
        i++;
        continue;
      }

      if (this.inString) {
        if (this.escapeNext) this.escapeNext = false;
        else if (c === "\\") this.escapeNext = true;
        else if (c === '"') this.inString = false;
        i++;
        continue;
      }

      if (c === '"') {
        this.inString = true;
      } else if (c === "{" || c === "[") {
        this.depth++;
      } else if (c === "}" || c === "]") {
        this.depth--;
        if (this.depth === 0) {
          const rowText = this.buf.slice(this.rowStart, i + 1);
          try {
            rows.push(JSON.parse(rowText) as ErpRow);
          } catch {
            // Skip a malformed row rather than aborting the whole sync over one bad record.
          }
          this.rowStart = -1;
        }
      }
      i++;
    }

    // Trim to only the unconsumed tail — from the in-progress row's start if we're
    // mid-row, otherwise from wherever the scan stopped — so `buf` never grows toward
    // the full feed size across calls.
    const keepFrom = this.depth > 0 ? this.rowStart : i;
    this.buf = this.buf.slice(keepFrom);
    if (this.rowStart >= 0) this.rowStart -= keepFrom;

    return rows;
  }
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

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Secret check reads from Postgres Vault (the same `orders_sync_secret` row
  // db/orders/003_orders_sync_cron.sql's cron job already reads to build its own
  // request header) rather than a Deno.env project secret — changed 2026-09-02
  // because no tool available to that session could set a project-level Function
  // secret through the Dashboard/CLI, but it already had full database access. Same
  // security property (a shared value the cron job and this function both need to
  // agree on, never exposed to the public internet), just stored where it was
  // actually reachable. Goes through get_orders_sync_secret() (public schema, RPC,
  // service_role only) rather than `.schema("vault").from(...)` directly — PostgREST
  // only exposes the `public` schema, so a direct vault query 404s no matter what
  // table-level grants say; the RPC function reads vault internally where schema
  // exposure doesn't apply.
  const { data: expectedSecret, error: secretError } = await supabaseAdmin.rpc("get_orders_sync_secret");
  const providedSecret = req.headers.get("x-orders-sync-secret");
  if (secretError || !expectedSecret || providedSecret !== expectedSecret) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

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
    if (!erpResponse.body) {
      throw new Error("ERP feed response had no body to stream");
    }

    let totalRows = 0;
    let upserted = 0;
    let stageEventsInserted = 0;
    const errors: string[] = [];
    let pendingBatch: ErpRow[] = [];
    let batchIndex = 0;

    // Runs the exact same per-batch logic the old array-slicing loop did — pulled out
    // so it can be called both as each streamed batch fills up AND once more for
    // whatever's left over at the end (a batch that never reached BATCH_SIZE).
    async function processBatch(batch: ErpRow[]): Promise<void> {
      if (!batch.length) return;
      const label = batchIndex++;

      const itemNos = batch.map((r) => str(r, "Item No_")!);
      const { data: existing, error: existingError } = await supabaseAdmin
        .from("orders")
        .select("id, item_no, stage_id")
        .in("item_no", itemNos);
      if (existingError) {
        errors.push(`existing lookup batch ${label}: ${existingError.message}`);
        return;
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
        errors.push(`upsert batch ${label}: ${upsertError.message}`);
        return;
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
          errors.push(`stage events batch ${label}: ${eventsError.message}`);
        } else {
          stageEventsInserted += eventsToInsert.length;
        }
      }
    }

    // Read the feed as it arrives — never buffer the whole ~145MB response or hold the
    // full ~120,000-row array in memory at once (that's what hit WORKER_RESOURCE_LIMIT).
    // Peak memory here is one network chunk plus one BATCH_SIZE-sized batch.
    const reader = erpResponse.body.getReader();
    const decoder = new TextDecoder();
    const streamer = new RowStreamer();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const rowsFromChunk = streamer.feed(decoder.decode(value, { stream: true }));
      for (const row of rowsFromChunk) {
        totalRows++;
        if (!str(row, "Item No_")) continue;
        pendingBatch.push(row);
        if (pendingBatch.length >= BATCH_SIZE) {
          await processBatch(pendingBatch);
          pendingBatch = [];
        }
      }
    }
    await processBatch(pendingBatch); // whatever's left under one full batch

    return jsonResponse({
      totalRows,
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
