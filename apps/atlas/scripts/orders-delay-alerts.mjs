// Delay-alert detection — real business requirement, confirmed directly in a recorded
// meeting with a sales team member (2026-09-05): once an order's current stage has run
// longer than its standard TAT, an alert should fire. Trigger rule confirmed verbatim:
// "3 din the actual TAT tha, 4th din pe mail bhejo" — the exact moment the stage
// standard formula already calls "breached" (pendingDays > standardDays), no extra
// grace period needed.
//
// This script only DETECTS and COMPOSES — it writes one row per (order, day) to
// order_delay_alerts (see db/orders/012_delay_alerts.sql) and does NOT send anything.
// Sending needs a real email service connected first (not done yet — see that
// migration's comment); until then this is the same "compose it, don't fake a send"
// posture the live-preview prototype's own Alerts outbox used, but for real orders,
// with a real de-dupe record instead of being recomputed from scratch on every page
// load.
//
// Run manually: cd apps/atlas && node --env-file=.env.local scripts/orders-delay-alerts.mjs
// Scheduled the same way as orders-sync.mjs (system cron), right after it, so the
// standard/pending-day numbers this reads are always freshly synced.

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment.");
  process.exit(1);
}
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

const STOCK_CUSTOMER_CODES = ["0277", "0177", "0877", "0322", "0108"];

// --- Stage-standard formula — kept in exact lockstep with apps/atlas/lib/stageTat.ts.
// Duplicated rather than imported because this runs as a plain Node script, not through
// the Next.js build (same reason orders-sync.mjs hand-duplicates its own helpers). If
// you change one, change both.
const SWATCH_MAX_SQFT = 4;
const SAMPLE_TOTAL_DAYS = 15;

function isSwatch(stdCubage) {
  return stdCubage !== null && stdCubage > 0 && stdCubage < SWATCH_MAX_SQFT;
}

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

function loomStandardDays(quality, size) {
  if (!quality) return null;
  if (/handloom/i.test(quality)) return 8;
  if (/tufted/i.test(quality)) return 12;
  const knotMatch = quality.match(/(\d+)\s*\/\s*\d+/);
  if (!knotMatch) return null;
  const knotCount = Number(knotMatch[1]);
  const ratePerDay = knotCount < 6 ? 3 : knotCount <= 9 ? 2 : knotCount <= 11 ? 1.5 : 1;
  const dimFt = maxDimensionFt(size);
  if (dimFt === null) return null;
  return Math.ceil((dimFt * 12) / ratePerDay);
}

const STATUS_TAT_RULES = [
  { pattern: /order\s*process/i, days: 1 },
  { pattern: /design/i, days: 15, priority0Days: 7 },
  { pattern: /ppc/i, days: 1 },
  { pattern: /stores?/i, days: 10 },
  { pattern: /branch/i, days: 7 },
  { pattern: /in[\s-]*transit/i, days: 10 },
  { pattern: /repair/i, days: 2 },
  { pattern: /finish(ing)?/i, days: 15 },
  { pattern: /check(ing)?|inspection/i, days: 2 },
];

function stageStandard(order) {
  const isOnHold = Boolean(order.on_hold && order.on_hold.trim() && !/^(0|no)$/i.test(order.on_hold.trim()));
  if (isOnHold) return { status: "on_hold", standardDays: null };

  let standardDays;
  if (isSwatch(order.std_cubage)) {
    standardDays = SAMPLE_TOTAL_DAYS;
  } else if (order.raw_current_status && /loom/i.test(order.raw_current_status) && !/preloom|pre-loom/i.test(order.raw_current_status)) {
    standardDays = loomStandardDays(order.quality, order.size);
  } else {
    const rule = order.raw_current_status ? STATUS_TAT_RULES.find((r) => r.pattern.test(order.raw_current_status)) : undefined;
    standardDays = rule ? (order.order_priority === 0 && rule.priority0Days !== undefined ? rule.priority0Days : rule.days) : null;
  }

  if (standardDays === null || standardDays === undefined) return { status: "no_standard", standardDays: null };
  const pendingDays = order.current_status_pending_days ?? 0;
  if (pendingDays > standardDays) return { status: "breached", standardDays, overBy: pendingDays - standardDays };
  return { status: "within", standardDays };
}
// --- end stage-standard formula

async function main() {
  const { data: stages, error: stagesError } = await supabaseAdmin.from("stages").select("id, is_terminal");
  if (stagesError) throw stagesError;
  const terminalStageIds = new Set(stages.filter((s) => s.is_terminal).map((s) => s.id));

  const { data: salespersonLinks, error: spError } = await supabaseAdmin
    .from("employee_salesperson_codes")
    .select("salesperson_code, employees(full_name, email)");
  if (spError) throw spError;
  const employeesByCode = new Map();
  for (const row of salespersonLinks) {
    const list = employeesByCode.get(row.salesperson_code) ?? [];
    if (row.employees) list.push(row.employees);
    employeesByCode.set(row.salesperson_code, list);
  }

  const today = new Date().toISOString().slice(0, 10);
  const PAGE_SIZE = 1000;
  let from = 0;
  let totalChecked = 0;
  let totalBreached = 0;
  let totalNewAlerts = 0;
  const rowsToInsert = [];

  while (true) {
    const { data: orders, error } = await supabaseAdmin
      .from("orders")
      .select(
        "id, otn_no, item_no, design, merchant_name, customer_no, salesperson_code, follow_up_person, raw_current_status, quality, size, std_cubage, order_priority, on_hold, current_status_pending_days, stage_id, revised_ex_factory_date",
      )
      .not("customer_no", "in", `(${STOCK_CUSTOMER_CODES.join(",")})`)
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!orders.length) break;

    for (const order of orders) {
      totalChecked++;
      if (order.stage_id && terminalStageIds.has(order.stage_id)) continue;
      const standard = stageStandard(order);
      if (standard.status !== "breached") continue;
      totalBreached++;

      const salespeople = order.salesperson_code ? employeesByCode.get(order.salesperson_code) ?? [] : [];
      const recipients = [];
      if (salespeople.length) {
        for (const emp of salespeople) {
          recipients.push({ role: "salesperson", name: emp.full_name, email: emp.email });
        }
      } else if (order.salesperson_code) {
        recipients.push({ role: "salesperson", name: order.salesperson_code, email: null });
      }
      if (order.follow_up_person) {
        recipients.push({ role: "follow_up_person", name: order.follow_up_person, email: null });
      }
      // Sales-backend recipient deliberately omitted, not fabricated — there is no
      // "backend contact for this salesperson" mapping anywhere in this schema yet
      // (confirmed before building this). Noted in the body instead of inventing a name.

      const subject = `[Atlas] Delay alert — ${order.otn_no} · ${order.design ?? "—"} — ${standard.standardDays}d standard, ${order.current_status_pending_days}d so far`;
      const body = [
        `Order: ${order.otn_no} (${order.item_no})`,
        `Design: ${order.design ?? "—"} · Merchant: ${order.merchant_name ?? "—"} (${order.customer_no ?? "—"})`,
        `Current status: ${order.raw_current_status ?? "—"}`,
        `Standard for this stage: ${standard.standardDays} day(s) — currently at ${order.current_status_pending_days} day(s), ${standard.overBy} over.`,
        `Rev. Ex-Factory: ${order.revised_ex_factory_date ?? "—"}`,
        "",
        "Recipients:",
        ...recipients.map((r) => `  - ${r.role}: ${r.name}${r.email ? ` <${r.email}>` : " (no email on file yet)"}`),
        "  - sales backend: not resolvable yet — no backend-contact mapping exists for this salesperson",
      ].join("\n");

      rowsToInsert.push({
        order_id: order.id,
        alert_date: today,
        stage_id: order.stage_id,
        standard_days: standard.standardDays,
        pending_days: order.current_status_pending_days ?? 0,
        overdue_by_days: standard.overBy,
        subject,
        body,
        recipients,
      });
    }

    if (orders.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  // Insert in chunks, ignoring duplicates (same order already alerted today) via the
  // table's own unique(order_id, alert_date) constraint rather than pre-checking.
  const CHUNK = 500;
  for (let i = 0; i < rowsToInsert.length; i += CHUNK) {
    const chunk = rowsToInsert.slice(i, i + CHUNK);
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("order_delay_alerts")
      .upsert(chunk, { onConflict: "order_id,alert_date", ignoreDuplicates: true })
      .select("id");
    if (insertError) {
      console.error(`[orders-delay-alerts] insert chunk ${i / CHUNK} failed:`, insertError.message);
      continue;
    }
    totalNewAlerts += inserted?.length ?? 0;
  }

  console.log(
    `[orders-delay-alerts] checked=${totalChecked} breached=${totalBreached} newAlertsToday=${totalNewAlerts} (already-alerted-today rows are skipped, not counted as new)`,
  );
}

main().catch((err) => {
  console.error("[orders-delay-alerts] fatal:", err instanceof Error ? err.message : err);
  process.exit(1);
});
