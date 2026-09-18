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
// Source switched 2026-09-07: reads the real NAV MSSQL database directly
// (`NAV-002-Rug List - Main` view) instead of the public
// https://webapi.jaipurrugs.com/api/ERP/rug-list feed. Confirmed live that day: the
// public feed was both stale (lagging real NAV by hundreds of Sales Orders — see
// ERP_AND_EXTERNAL_REQUESTS.md request #3) and narrower (missing Customer Service Zone,
// Original/Rev Ex India, HSN/SAC No, Sales Line No_, Current Location — request #6 —
// even though the database already has all of them). This view was chosen over the
// `... - ERP` view (215 cols) because it's the only one confirmed to also carry
// Salesperson Code (225 cols total); every field this script needs is present.
//
// Run manually:
//   cd apps/atlas && node --env-file=.env.local scripts/orders-sync.mjs
// Scheduled via a Linux cron entry on the server (see deploy notes in architecture.md),
// not pg_cron — nothing in Postgres calls this anymore.
//
// *** MSSQL_PASSWORD cannot be rotated — not even by the NAV admin (confirmed directly
// by Ayaan, 2026-09-07). Treat apps/atlas/.env.local on whichever server holds it with
// more care than any other secret here: never in git, never in chat, never echoed by a
// log line. MSSQL_SERVER is an internal office-network address — this script can only
// run from a machine with a network route to it (the office server; NOT a public server
// like the Hostinger VPS). ***
//
// Needs, in apps/atlas/.env.local on the server (NOT committed to git):
//   NEXT_PUBLIC_SUPABASE_URL         (already there for the Next.js app)
//   SUPABASE_SERVICE_ROLE_KEY        (server-only — bypasses RLS the same way the old
//                                     Edge Function's built-in service role did; get it
//                                     from the Supabase Dashboard's Project Settings ->
//                                     API page, "service_role" secret)
//   MSSQL_SERVER / MSSQL_PORT / MSSQL_DATABASE / MSSQL_USER / MSSQL_PASSWORD /
//   MSSQL_ENCRYPT / MSSQL_TRUST_SERVER_CERTIFICATE  (see .env.example's comment)

import { createClient } from "@supabase/supabase-js";
import sql from "mssql";

const BATCH_SIZE = 500;
// One row per (Sales Order No_, Sales Line No_, Item No_) in the source view — matches
// what the public feed already returned (confirmed 2026-09-07: item_no is unique per
// row here too), so the existing dedup-by-item_no in processBatch below still applies.
const NAV_VIEW = "[NAV-002-Rug List - Main]";

// Real dispatch + tracking data — from two DIFFERENT NAV reports NAV_VIEW doesn't cover
// at all: a dispatched rug just silently disappears from NAV_VIEW, with no "Dispatched"
// status text anywhere in it. Confirmed live, 2026-09-15, investigating a real
// merchant-reported discrepancy — see ERP_AND_EXTERNAL_REQUESTS.md request #9. Both
// keyed on Item No_ (this schema's real unique key — see ORDERS' own header comment;
// OTN No_ is NOT guaranteed unique) — confirmed live that both reports carry it in the
// exact same format as orders.item_no (e.g. "RUG1231676").
//
// Both source reports only retain a rolling window (confirmed live: NAV-011 ~30 days,
// the tracking view ~3 months) — see syncDispatchStatus()/syncTrackingInfo()'s own
// comments for why that means "never clear a value once set here."
const NAV011_VIEW = "[NAV-011- Posted Whse Shipment Packing List]";
const AWB_TRACKING_VIEW = "[View-0462-Sales_Inv_With_AWB_Tracking_And_Bale_Wise_Details]";
const SHIPPING_AGENT_TABLE = "[JRCPL Live$Shipping Agent]";

// Bigger than the main loop's BATCH_SIZE on purpose — syncDispatchStatus/syncTrackingInfo
// upsert a handful of columns (not a full mapErpRowToOrder() row, ~50+ columns), so a
// much bigger .in() item_no list per round trip is still a small payload. Added
// 2026-09-18, real production incident: these two passes' extra round trips (on top of
// the main loop's own ~370 batches × 2 calls) coincided with real "canceling statement
// due to statement timeout" 500s on orders_dashboard_stats/orders_list_facets during a
// live sync run — table bloat and the RPCs' own query cost were both ruled out directly
// (checked live: 48MB table, autovacuum current, RPCs measured fast when built), so this
// cuts the number of concurrent-with-everything-else round trips these two passes add,
// regardless of the exact contention mechanism. See ERP_AND_EXTERNAL_REQUESTS.md or the
// commit message for the fuller incident writeup.
const LIGHTWEIGHT_BATCH_SIZE = 1500;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment.");
  process.exit(1);
}
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

const mssqlBaseConfig = {
  server: process.env.MSSQL_SERVER,
  port: Number(process.env.MSSQL_PORT || 1433),
  database: process.env.MSSQL_DATABASE,
  user: process.env.MSSQL_USER,
  password: process.env.MSSQL_PASSWORD,
  connectionTimeout: 30000,
  requestTimeout: 180000, // ~180k-row query — the public feed's own fetch had no timeout either
};
if (!mssqlBaseConfig.server || !mssqlBaseConfig.database || !mssqlBaseConfig.user || !mssqlBaseConfig.password) {
  console.error("Missing one or more MSSQL_* environment variables — see .env.example.");
  process.exit(1);
}

/** Confirmed live 2026-09-07: connecting encrypted to this server (addressed by raw IP —
 * MSSQL_SERVER=192.168.0.41, no hostname) fails, but with a DIFFERENT error depending on
 * the Node/OpenSSL build actually running it:
 *   - Newer Node (local dev machine, v26): hard-rejects synchronously before any network
 *     traffic — "Setting the TLS ServerName to an IP address is not permitted" (Node's
 *     TLS module enforcing RFC 6066: SNI must be a hostname, never an IP-literal).
 *   - Older Node (this office server, v22): only warns (DEP0123) and proceeds, then the
 *     actual TLS handshake fails server-side instead — "unsupported protocol" (an SSL/TLS
 *     version-negotiation mismatch between this OpenSSL build and the SQL Server's).
 * Both are connection-phase failures with no real fix available (tedious doesn't
 * correctly skip SNI for an IP server in every code path; neither an empty
 * `options.serverName` nor any other tedious-level workaround avoided the first one).
 * Rather than pattern-match increasingly many specific error strings across Node
 * versions, catch any connection-phase failure during the encrypted attempt (ESOCKET, or
 * mssql's own ConnectionError) and fall back. Safe because `MSSQL_TRUST_SERVER_CERTIFICATE
 * =true` was already given (certificate identity was never being validated anyway) and
 * this address is only reachable on the internal office LAN — never the public internet.
 * Made loudly (logged), not silently. Tries encrypted first: if MSSQL_SERVER is ever
 * changed to a real hostname, this automatically uses real encryption with zero code
 * changes, since a real hostname wouldn't hit either failure. */
async function connectWithEncryptionFallback() {
  const encryptedConfig = {
    ...mssqlBaseConfig,
    options: {
      encrypt: process.env.MSSQL_ENCRYPT !== "false",
      trustServerCertificate: process.env.MSSQL_TRUST_SERVER_CERTIFICATE !== "false",
    },
  };
  try {
    return await sql.connect(encryptedConfig);
  } catch (err) {
    const isConnectionPhaseFailure = err?.code === "ESOCKET" || err?.name === "ConnectionError";
    if (!isConnectionPhaseFailure) throw err;
    console.warn(
      `[orders-sync] WARNING: encrypted MSSQL connection failed (${err?.message ?? err}) — falling back to an unencrypted connection. Only safe because this server is internal-office-LAN-only, never internet-facing. See this script's connectWithEncryptionFallback() comment.`,
    );
    return await sql.connect({ ...mssqlBaseConfig, options: { ...encryptedConfig.options, encrypt: false } });
  }
}

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
// Confirmed live 2026-09-07: 1,600+ real rows carry "1753-01-01" in Rev_Ex Factory /
// Original Ex Factory — SQL Server's DateTime.MinValue, the ERP's own "no date set"
// placeholder leaking through as a syntactically valid date. It passed DATE_ONLY_RE
// (right shape, implausible value) and was silently stored as a real date, which then
// made ~1,600 orders show as wildly "Delayed" (On Time badge) or ~99,000 days overdue
// (Stage Standard fallback) instead of correctly having no date to compare against.
// Same "no" as null, not a real date.
function dateOnly(row, key) {
  const v = str(row, key);
  if (!v) return null;
  const candidate = v.slice(0, 10);
  if (!DATE_ONLY_RE.test(candidate)) return null;
  return Number(candidate.slice(0, 4)) < 1900 ? null : candidate;
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
    sales_line_no: num(row, "Sales Line No_"),
    serial_no: str(row, "Serial No_"),
    production_order_no: str(row, "Production Order No_"),
    customer_no: str(row, "Customer No_"),
    merchant_name: str(row, "Merchant Name"),
    order_wise_merchant: str(row, "Order Wise Merchant"),
    customer_po_no: str(row, "Customer PO No_"),
    salesperson_code: str(row, "Salesperson Code"),
    raw_current_status: str(row, "Current Status"),
    stage_id: stageId ?? null,
    current_status_pending_days: num(row, "Current Staus Pending Days"),
    production_order_status: str(row, "Production Order Status"),
    on_hold: str(row, "On Hold"),
    order_priority: num(row, "Order Priority"),
    // Authorization and Remark: confirmed absent from the NAV database itself
    // (2026-09-07 — no column of either name in NAV-002-Rug List - Main), not just
    // unmapped here. Left explicitly null rather than guessed at or silently dropped
    // from the object entirely.
    authorization: null,
    remark: null,
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
    // Expected Ready Date: confirmed absent from the NAV database under that or any
    // obviously-equivalent name (2026-09-07) — "Expected Receipt Date" exists but its
    // semantic equivalence isn't confirmed, so left null rather than guessed.
    expected_ready_date: null,
    follow_up_person: str(row, "Follow Up Person"),
    project_coordinator: str(row, "Project Coodinator"),
    // New 2026-09-07 — see db/orders/013_nav_direct_fields.sql.
    customer_service_zone: str(row, "Customer Service Zone"),
    original_ex_india_date: dateOnly(row, "Original Ex India"),
    revised_ex_india_date: dateOnly(row, "Rev_Ex India"),
    hsn_sac_no: str(row, "HSN/SAC No"),
    current_location: str(row, "Current Location"),
    erp_synced_at: new Date().toISOString(),
  };
}

/** Real dispatch status, from a completely different NAV report than NAV_VIEW (see the
 * constants' comment above for why). Only ever UPDATES an existing `orders` row matched
 * by item_no — deliberately does NOT insert a new row for an item_no NAV-011 mentions
 * but Supabase has never seen at all (this happens — see request #9). Backfilling a
 * never-synced order from scratch is a bigger, separate decision than "show dispatched
 * status for orders Atlas already knows about", which is what was actually asked for.
 *
 * Only touches items whose `dispatched_at` is CURRENTLY null — once set, it's never
 * overwritten (NAV-011 only retains ~30 days; an item aging out of a later pull must
 * not undo this), and re-writing an unchanged value on every run would just be wasted
 * work. This also doubles as "is this a real transition" for the stage-event insert
 * below, the same way the main sync loop's own previous/mapped comparison does. */
async function syncDispatchStatus(pool, dispatchedStageId) {
  if (!dispatchedStageId) {
    console.warn('[orders-sync] WARNING: no "dispatched" stage found — skipping dispatch-status sync. Run db/orders/029_dispatch_tracking.sql first.');
    return { updated: 0, stageEventsInserted: 0 };
  }

  const result = await pool.request().query(`
    SELECT [Item No_], CONVERT(varchar(10), [Posting Date], 23) AS [Posting Date], [Sales Shipment No]
    FROM ${NAV011_VIEW}
  `);

  // Same "last occurrence in feed order wins" dedup as processBatch — a shipment can
  // carry more than one line for the same item in rare correction/reissue cases.
  const byItemNo = new Map();
  for (const row of result.recordset) {
    const itemNo = str(row, "Item No_");
    if (!itemNo) continue;
    const postingDate = dateOnly(row, "Posting Date");
    if (!postingDate) continue; // no real date — treat like any other unparseable date here
    byItemNo.set(itemNo, { itemNo, postingDate, shipmentNo: str(row, "Sales Shipment No") });
  }
  console.log(`[orders-sync] NAV-011: ${result.recordset.length} rows -> ${byItemNo.size} distinct dispatched items`);

  const itemNos = [...byItemNo.keys()];
  let updated = 0;
  let stageEventsInserted = 0;

  for (let i = 0; i < itemNos.length; i += LIGHTWEIGHT_BATCH_SIZE) {
    const batchItemNos = itemNos.slice(i, i + LIGHTWEIGHT_BATCH_SIZE);
    const { data: existing, error: existingError } = await supabaseAdmin
      .from("orders")
      .select("id, item_no, otn_no, dispatched_at")
      .in("item_no", batchItemNos);
    if (existingError) {
      console.error(`[orders-sync] dispatch-status lookup batch failed: ${existingError.message}`);
      continue;
    }

    const toUpdate = (existing ?? []).filter((o) => !o.dispatched_at);
    if (!toUpdate.length) continue;

    // otn_no must be included even though this is really an update, not an insert —
    // Supabase's upsert still builds a real `INSERT ... ON CONFLICT (item_no) DO
    // UPDATE`, and Postgres validates the row's NOT NULL constraints (otn_no has no
    // default) before it even gets to resolving the conflict, regardless of which
    // branch actually runs. Hit live, 2026-09-16: every one of these upserts failed
    // with "null value in column otn_no" until this was added — same otn_no already on
    // the row, just re-stating it so the constraint is satisfied.
    const upsertRows = toUpdate.map((o) => {
      const info = byItemNo.get(o.item_no);
      return {
        item_no: o.item_no,
        otn_no: o.otn_no,
        dispatched_at: info.postingDate,
        sales_shipment_no: info.shipmentNo,
        stage_id: dispatchedStageId,
      };
    });
    const { error: upsertError } = await supabaseAdmin.from("orders").upsert(upsertRows, { onConflict: "item_no" });
    if (upsertError) {
      console.error(`[orders-sync] dispatch-status upsert batch failed: ${upsertError.message}`);
      continue;
    }
    updated += upsertRows.length;

    const eventsToInsert = toUpdate.map((o) => ({
      order_id: o.id,
      stage_id: dispatchedStageId,
      entered_at: new Date(byItemNo.get(o.item_no).postingDate).toISOString(),
      source: "erp_sync",
    }));
    const { error: eventsError } = await supabaseAdmin
      .from("order_stage_events")
      .upsert(eventsToInsert, { onConflict: "order_id,stage_id,entered_at", ignoreDuplicates: true });
    if (eventsError) {
      console.error(`[orders-sync] dispatch-status stage-events batch failed: ${eventsError.message}`);
    } else {
      stageEventsInserted += eventsToInsert.length;
    }
  }

  return { updated, stageEventsInserted };
}

/** Real courier/AWB tracking numbers, from yet another NAV report (View-0462) — has no
 * OTN No_ or Sales Order No_/Customer PO No_ column at all, only Item No_ (this
 * schema's real unique key, same as syncDispatchStatus above) and a raw
 * Shipping Agent Code, which gets resolved to a real name here (e.g. "MH-004" ->
 * "BLUE DART EXPRESS LIMITED") via NAV's own agent master table — the UI should never
 * need to know that mapping itself.
 *
 * Confirmed live, 2026-09-15: only ~5-9% of shipment lines ever get a real tracking
 * number (most real moves are a domestic warehouse transfer via a regional transporter
 * or company vehicle, which never generates one) — null here is very often the honest,
 * permanent answer, not missing data. Only rows WITH a real tracking number are even
 * queried; same "only touch if currently null, never overwrite" rule as dispatch status
 * above, for the same reason (this view only retains ~3 months). */
async function syncTrackingInfo(pool) {
  const agentRows = await pool.request().query(`SELECT [Code], [Name] FROM ${SHIPPING_AGENT_TABLE}`);
  const agentNameByCode = new Map(agentRows.recordset.map((r) => [str(r, "Code"), str(r, "Name")]));

  const result = await pool.request().query(`
    SELECT [ItemCode], [TrackingNo], [Shipping Agent Code], [EWB No]
    FROM ${AWB_TRACKING_VIEW}
    WHERE [TrackingNo] IS NOT NULL AND LTRIM(RTRIM([TrackingNo])) <> ''
  `);

  const byItemNo = new Map();
  for (const row of result.recordset) {
    const itemNo = str(row, "ItemCode");
    const trackingNo = str(row, "TrackingNo");
    if (!itemNo || !trackingNo) continue;
    const agentCode = str(row, "Shipping Agent Code");
    byItemNo.set(itemNo, {
      itemNo,
      trackingNo,
      agentCode,
      agentName: agentCode ? agentNameByCode.get(agentCode) ?? agentCode : null,
      ewbNo: str(row, "EWB No"),
    });
  }
  console.log(`[orders-sync] AWB tracking: ${result.recordset.length} rows -> ${byItemNo.size} distinct items with a real tracking number`);

  const itemNos = [...byItemNo.keys()];
  let updated = 0;

  for (let i = 0; i < itemNos.length; i += LIGHTWEIGHT_BATCH_SIZE) {
    const batchItemNos = itemNos.slice(i, i + LIGHTWEIGHT_BATCH_SIZE);
    const { data: existing, error: existingError } = await supabaseAdmin
      .from("orders")
      .select("item_no, otn_no, tracking_no")
      .in("item_no", batchItemNos);
    if (existingError) {
      console.error(`[orders-sync] tracking-info lookup batch failed: ${existingError.message}`);
      continue;
    }

    const toUpdate = (existing ?? []).filter((o) => !o.tracking_no);
    if (!toUpdate.length) continue;
    // otn_no included for the same reason syncDispatchStatus's own upsert needs it —
    // see that function's comment.

    const upsertRows = toUpdate.map((o) => {
      const info = byItemNo.get(o.item_no);
      return {
        item_no: o.item_no,
        otn_no: o.otn_no,
        tracking_no: info.trackingNo,
        shipping_agent_code: info.agentCode,
        shipping_agent_name: info.agentName,
        ewb_no: info.ewbNo,
      };
    });
    const { error: upsertError } = await supabaseAdmin.from("orders").upsert(upsertRows, { onConflict: "item_no" });
    if (upsertError) {
      console.error(`[orders-sync] tracking-info upsert batch failed: ${upsertError.message}`);
      continue;
    }
    updated += upsertRows.length;
  }

  return { updated };
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
  const dispatchedStageId = stageByCode.get("dispatched");

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

  console.log(`[orders-sync] connecting to NAV MSSQL (${NAV_VIEW}) ...`);
  const pool = await connectWithEncryptionFallback();
  let rows;
  try {
    // Date columns are CONVERTed to a plain 'yyyy-mm-dd' varchar right here in SQL
    // (style 23), rather than left as datetime and converted client-side — sidesteps
    // any ambiguity in how the mssql/tedious driver would otherwise interpret a
    // timezone-less SQL Server DATETIME as a JS Date. Aliased back to the same column
    // names dateOnly() below already expects, so no other code needs to change.
    const result = await pool.request().query(`
      SELECT
        [OTN No_], [Item No_], [Sales Order No_], [Sales Line No_], [Serial No_],
        [Production Order No_], [Customer No_], [Merchant Name], [Order Wise Merchant],
        [Customer PO No_], [Salesperson Code], [Current Status],
        [Current Staus Pending Days], [Production Order Status], [On Hold],
        [Order Priority], [Quality], [Design], [Size], [Size In Cm], [Shape],
        [Construction], [India Collection], [Pile Fibre], [Pile Height],
        [GR Color Name], [BR Color Name], [Matching Code], [Backing], [Std Cubage],
        [Item Description], [US Item Code], [Quick Ship], [Warehouse Shipment Created],
        [Follow Up Person], [Project Coodinator], [Customer Service Zone],
        [HSN/SAC No], [Current Location],
        CONVERT(varchar(10), [Sales Order Date], 23) AS [Sales Order Date],
        CONVERT(varchar(10), [Rev_Ex Factory], 23) AS [Rev_Ex Factory],
        CONVERT(varchar(10), [Original Ex Factory], 23) AS [Original Ex Factory],
        CONVERT(varchar(10), [Promised Delivery Date], 23) AS [Promised Delivery Date],
        CONVERT(varchar(10), [Original Ex India], 23) AS [Original Ex India],
        CONVERT(varchar(10), [Rev_Ex India], 23) AS [Rev_Ex India]
      FROM ${NAV_VIEW}
    `);
    rows = result.recordset;
  } finally {
    await pool.close();
  }
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

  // Real dispatch status + tracking, from two different NAV reports NAV_VIEW doesn't
  // cover at all — deliberately run AFTER the main loop above, not before or in
  // parallel: this must have final say on stage_id for a dispatched item. A dispatched
  // rug has almost always already vanished from NAV_VIEW by the time this runs, but in
  // the rare case it briefly still appears there too, the main loop's own resolveStageId
  // result for it must not win. See ERP_AND_EXTERNAL_REQUESTS.md request #9.
  console.log(`[orders-sync] connecting to NAV MSSQL again (${NAV011_VIEW} / ${AWB_TRACKING_VIEW}) ...`);
  const dispatchPool = await connectWithEncryptionFallback();
  let dispatchResult = { updated: 0, stageEventsInserted: 0 };
  let trackingResult = { updated: 0 };
  try {
    dispatchResult = await syncDispatchStatus(dispatchPool, dispatchedStageId);
    trackingResult = await syncTrackingInfo(dispatchPool);
  } catch (err) {
    errors.push(`dispatch/tracking sync: ${err instanceof Error ? err.message : err}`);
  } finally {
    await dispatchPool.close();
  }

  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(
    `[orders-sync] done in ${seconds}s — totalRows=${rows.length} upserted=${counters.upserted} stageEventsInserted=${counters.stageEventsInserted} ` +
      `dispatchUpdated=${dispatchResult.updated} dispatchStageEvents=${dispatchResult.stageEventsInserted} trackingUpdated=${trackingResult.updated} errors=${errors.length}`,
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
