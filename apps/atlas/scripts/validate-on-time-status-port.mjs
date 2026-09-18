// Cross-validates db/orders/024_on_time_status_view.sql's SQL port of
// lib/stageTat.ts's stageStandard()/loomStandardDays()/maxDimensionFt() and
// lib/tat.ts's onTimeStatus() against the real TypeScript, row by row, over every real
// (non-stock) order — NOT a sample. Run this once 024 is actually applied, BEFORE
// wiring the frontend "Late" tab to orders_with_on_time_status — see that migration's
// own header for why a port like this needs live cross-validation, not just a code
// review, before being trusted on a tool 124 people use for real TAT decisions.
//
// Run: cd apps/atlas && node --env-file=.env.local scripts/validate-on-time-status-port.mjs
// Needs the same env vars orders-sync.mjs does (NEXT_PUBLIC_SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY) — service role so RLS doesn't limit which rows are seen
// (this must check the SAME full set the view can compute over).
//
// Prints only the MISMATCHES (rows where the SQL view's computed_on_time_status or
// computed_stage_standard_days disagrees with what this exact same TS logic, copied
// from the real lib files, produces) plus a final summary count. Zero mismatches is
// the bar for "safe to wire up the frontend" — any mismatch means either the SQL port
// or this script has a bug, and both need to be re-checked before trusting either.

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment.");
  process.exit(1);
}
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

const STOCK_CUSTOMER_CODES = ["0277", "0177", "0877", "0322", "0108"];

// ---- Copied verbatim from apps/atlas/lib/stageTat.ts (2026-09-15) — keep in sync ----
const SWATCH_MAX_SQFT = 4;
const SAMPLE_TOTAL_DAYS = 15;

function isSwatch(stdCubage) {
  return stdCubage !== null && stdCubage > 0 && stdCubage < SWATCH_MAX_SQFT;
}

const ZERO_PRIORITY_KNOTTED_RATE = {
  "3/16": 8, "3/20": 8, "3/25": 8, "4/25": 6, "5/5": 6, "6.5/36": 6, "6/5": 6, "6/6": 4,
  "6/8": 5.5, "8/8": 3, "9/9": 2.25, "10/10": 2, "10/14": 2, "11/11": 1.75, "14/14": 1,
  "7/7": 4, "9/7": 3, "5/16": 7, "3.5/18": 10, "4/15": 10, "3/12": 10, "4/22": 10,
  "3/13": 10, "3.5/22": 10, "7/22": 6, "3.5/18 WL": 10, "8/6": 5.5, "2.5/14": 10,
  "6/20": 6, "5/15": 6, "6/4": 6, "3/7": 8, "5/25": 7, "3/15": 8, "5/22": 7, "5/21": 7,
  "3.5/25": 8, "3/10": 8, "5.5/30": 8, "5/32": 8, "4.25/30": 8, "5/35": 8,
};

function maxDimensionFt(size) {
  if (!size) return null;
  const matches = [...size.matchAll(/(\d+(?:\.\d+)?)\s*(['"]?)/g)];
  let maxFt = 0;
  for (const m of matches) {
    const value = Number(m[1]);
    if (!Number.isFinite(value) || value <= 0) continue;
    const isInches = m[2] === '"';
    const ft = isInches ? value / 12 : value;
    if (ft > maxFt) maxFt = ft;
  }
  return maxFt > 0 ? maxFt : null;
}

function loomStandardDays(quality, size, orderPriority) {
  if (!quality) return null;
  if (/handloom/i.test(quality)) return 12;
  if (/tufted/i.test(quality)) return 12;

  const knotMatch = quality.match(/(\d+(?:\.\d+)?)\s*\/\s*\d+(?:\.\d+)?(?:\s+\S+)?/);
  if (!knotMatch) return 12;

  const dimFt = maxDimensionFt(size);
  if (dimFt === null) return null;

  let ratePerDay;
  if (orderPriority === 0) {
    const trimmed = quality.trim();
    const bareKnotPattern = knotMatch[0].split(/\s+/)[0] ?? knotMatch[0];
    ratePerDay = ZERO_PRIORITY_KNOTTED_RATE[trimmed] ?? ZERO_PRIORITY_KNOTTED_RATE[bareKnotPattern];
  }
  if (ratePerDay === undefined) {
    const knotCount = Number(knotMatch[1]);
    ratePerDay = knotCount < 6 ? 3 : knotCount <= 9 ? 2 : knotCount <= 11 ? 1.5 : 1;
  }

  return Math.ceil((dimFt * 12) / ratePerDay);
}

const STATUS_TAT_RULES = [
  { pattern: /order\s*process/i, days: 2, priority0Days: 2 },
  { pattern: /design/i, days: 15, priority0Days: 7 },
  { pattern: /ppc/i, days: 1 },
  { pattern: /stores?/i, days: 10, priority0Days: 12 },
  { pattern: /branch/i, days: 10, priority0Days: 7 },
  { pattern: /in[\s-]*transit/i, days: 10, priority0Days: 7 },
  { pattern: /repair/i, days: 2, priority0Days: 3 },
  { pattern: /finish(ing)?/i, days: 15, priority0Days: 10 },
  { pattern: /check(ing)?|inspection/i, days: 2, priority0Days: 2 },
];

function stageStandard(order) {
  const isOnHold = Boolean(order.onHold && order.onHold.trim() && !/^(0|no)$/i.test(order.onHold.trim()));
  if (isOnHold) return null;

  let standardDays;
  if (isSwatch(order.stdCubage)) {
    standardDays = SAMPLE_TOTAL_DAYS;
  } else if (order.rawCurrentStatus && /loom/i.test(order.rawCurrentStatus) && !/preloom|pre-loom/i.test(order.rawCurrentStatus)) {
    standardDays = loomStandardDays(order.quality, order.size, order.orderPriority);
  } else {
    const rule = order.rawCurrentStatus
      ? STATUS_TAT_RULES.find((r) => r.pattern.test(order.rawCurrentStatus))
      : undefined;
    standardDays = rule ? (order.orderPriority === 0 && rule.priority0Days !== undefined ? rule.priority0Days : rule.days) : null;
  }
  return standardDays;
}

// ---- Copied verbatim from apps/atlas/lib/tat.ts (2026-09-15) — keep in sync ----
function onTimeStatus(promisedDeliveryDate, revisedExFactoryDate, isTerminalStage, stageStandardDays) {
  if (isTerminalStage) return "on_track";
  const target = revisedExFactoryDate ?? promisedDeliveryDate;
  if (!target) return "unknown";
  if (Number(target.slice(0, 4)) < 1900) return "unknown";
  const targetMs = new Date(target).getTime();
  if (Number.isNaN(targetMs)) return "unknown";
  const now = Date.now();
  if (now > targetMs) return "delayed";
  if (stageStandardDays !== null) {
    const predictedMs = now + stageStandardDays * 24 * 60 * 60 * 1000;
    if (predictedMs > targetMs) return "late";
  }
  return "on_track";
}
// ---- end copied logic ----

async function main() {
  const { data: stages, error: stagesError } = await supabaseAdmin.from("stages").select("id, is_terminal");
  if (stagesError) throw stagesError;
  const terminalByStageId = new Map(stages.map((s) => [s.id, s.is_terminal]));

  console.log("[validate] fetching all real orders + their SQL-computed on-time status ...");
  const pageSize = 1000;
  let from = 0;
  let totalChecked = 0;
  let mismatches = 0;

  for (;;) {
    const { data: rows, error } = await supabaseAdmin
      .from("orders_with_on_time_status")
      .select(
        "id, otn_no, customer_no, raw_current_status, quality, size, std_cubage, order_priority, on_hold, " +
          "current_status_pending_days, promised_delivery_date, revised_ex_factory_date, stage_id, " +
          "computed_stage_standard_days, computed_on_time_status",
      )
      .not("customer_no", "in", `(${STOCK_CUSTOMER_CODES.join(",")})`)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!rows.length) break;

    for (const row of rows) {
      totalChecked++;
      const jsStandard = stageStandard({
        rawCurrentStatus: row.raw_current_status,
        quality: row.quality,
        size: row.size,
        stdCubage: row.std_cubage,
        orderPriority: row.order_priority,
        onHold: row.on_hold,
      });
      const isTerminal = terminalByStageId.get(row.stage_id) ?? false;
      const jsStatus = onTimeStatus(row.promised_delivery_date, row.revised_ex_factory_date, isTerminal, jsStandard);

      const sqlStandard = row.computed_stage_standard_days === null ? null : Number(row.computed_stage_standard_days);
      const standardMismatch = jsStandard !== sqlStandard;
      const statusMismatch = jsStatus !== row.computed_on_time_status;

      if (standardMismatch || statusMismatch) {
        mismatches++;
        console.log(
          `[MISMATCH] otn=${row.otn_no} raw_status=${JSON.stringify(row.raw_current_status)} quality=${JSON.stringify(row.quality)} size=${JSON.stringify(row.size)}\n` +
            `  standard: js=${jsStandard} sql=${sqlStandard}${standardMismatch ? "  <-- DIFFERS" : ""}\n` +
            `  status:   js=${jsStatus} sql=${row.computed_on_time_status}${statusMismatch ? "  <-- DIFFERS" : ""}`,
        );
      }
    }

    from += pageSize;
    if (rows.length < pageSize) break;
  }

  console.log(`\n[validate] checked ${totalChecked} orders, ${mismatches} mismatch(es).`);
  if (mismatches === 0) {
    console.log("[validate] PASS — the SQL port agrees with the TypeScript on every real order checked.");
  } else {
    console.log("[validate] FAIL — do not wire the frontend to orders_with_on_time_status until every mismatch above is understood and fixed.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[validate] fatal:", err instanceof Error ? err.message : err);
  process.exit(1);
});
