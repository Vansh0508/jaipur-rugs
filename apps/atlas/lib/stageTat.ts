// "Stage standard" — how many days the order's CURRENT stage/status is normally
// expected to take, so it can sit next to the actual "Days in Stage" figure as a real
// comparison ("standard says 10d, you're at 34d"). Ported from the live-preview
// prototype's stageDelayV2()/loomStandardDays(), which was itself validated against
// real questions earlier this session ("what is the formula of At Loom stage TAT?" /
// "give all stages TAT for all qualities") — this is that same confirmed formula, now
// wired into production Atlas rather than only existing in the throwaway demo.
//
// Deliberately a plain per-status lookup, not a database table — matches
// db/orders/README.md's own note that the real final stage/TAT taxonomy was still being
// decided in a separate meeting when the orders module was built; this can move to a
// real `stage_tat_rules` reference table (same idiom as `stages`/`status_stage_map`)
// once those numbers are confirmed as final, without changing anything that calls it.

export type StageStandardStatus = "breached" | "within" | "no_standard" | "on_hold";

export interface StageStandardResult {
  status: StageStandardStatus;
  standardDays: number | null;
  /** How many days over the standard, only set when status is "breached". */
  overBy: number | null;
}

const SWATCH_MAX_SQFT = 4;
const SAMPLE_TOTAL_DAYS = 15;

/** Interim fallback for At-Loom orders whose quality has no known weaving rate yet (see
 * `loomStandardDays` below returning null for these) — confirmed directly by Ayaan,
 * 2026-09-06: "if Rev Ex Factory is 30th September, it should be off loom and moved to
 * finishing at least 12 days before" that date, regardless of quality/size. Temporary
 * until real per-quality rates are provided (tracked via "Atlas_TAT_gaps_to_fill.xlsx",
 * covers 80/100/60 LINE, Tuf Viscose Mix, Dhurrie, Jute Dhurrie, Woolen Dhurrie, TUF
 * NOR) — remove this fallback once every quality in that sheet has a real rate.
 * Deliberately applied only when the real weaving-rate formula can't produce a number at
 * all — an order with a known rate keeps using that, this never overrides it. */
const LOOM_MUST_EXIT_DAYS_BEFORE_REV_EX_FACTORY = 12;

/** Purely date-driven — deliberately ignores how many days the order has actually spent
 * at Loom (pendingDays only enters at the very end, to express the result in the same
 * "standardDays vs pendingDays" shape every other rule already uses), matching how the
 * rule was actually described: it's about the Rev Ex Factory deadline, not about how
 * long weaving normally takes for this quality (which is exactly the number we don't
 * have yet for these qualities). Returns null if there's no Rev Ex Factory date to
 * measure against — nothing to compute a standard from in that case either. */
function loomFallbackStandardDays(revisedExFactoryDate: string | null, pendingDays: number): number | null {
  if (!revisedExFactoryDate) return null;
  // Confirmed live 2026-09-07: some rows carry "1753-01-01" as Rev Ex Factory — SQL
  // Server's DateTime.MinValue, the ERP's own "no date set" placeholder leaking through
  // as a syntactically valid date string (it passes orders-sync.mjs's date-format
  // check, since that only validates shape, not plausibility). Without this guard these
  // would compute as ~99,000 days overdue instead of correctly falling back to
  // "no standard" — same as if the date were genuinely null.
  if (Number(revisedExFactoryDate.slice(0, 4)) < 1900) return null;
  const target = new Date(`${revisedExFactoryDate}T00:00:00Z`).getTime();
  if (Number.isNaN(target)) return null;
  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const daysUntilRevExFactory = Math.round((target - todayUtc) / (24 * 60 * 60 * 1000));
  const marginDays = daysUntilRevExFactory - LOOM_MUST_EXIT_DAYS_BEFORE_REV_EX_FACTORY;
  return pendingDays + marginDays;
}

/** A rug this small is a swatch/sample, not a real order — gets one flat standard for
 * its whole pipeline instead of a per-stage one. */
function isSwatch(stdCubage: number | null): boolean {
  return stdCubage !== null && stdCubage > 0 && stdCubage < SWATCH_MAX_SQFT;
}

/** Parses an ERP size string (e.g. `25'5X46`, `6X9'1`, `20"X20"`) and returns the
 * largest dimension in feet — used only to pick a weaving rate bucket, so approximate
 * parsing (largest number found, treating a bare `X`-separated number as inches unless
 * marked with a foot symbol) is good enough. Returns null if nothing parseable. */
function maxDimensionFt(size: string | null): number | null {
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

/** Loom stage standard: carpet length (inches) ÷ daily weaving rate, rate depending on
 * quality. Handloom/Tufted have a flat day count regardless of size; knotted qualities
 * (a quality string containing an `n/m` knot-count pattern, e.g. "8/8") get a rate based
 * on the first knot-count number — finer knotting weaves slower. Dhurrie/flat-weave
 * qualities have no rate in the source sheet, so return null (no standard, not zero). */
function loomStandardDays(quality: string | null, size: string | null): number | null {
  if (!quality) return null;
  if (/handloom/i.test(quality)) return 8;
  if (/tufted/i.test(quality)) return 12;

  const knotMatch = quality.match(/(\d+)\s*\/\s*\d+/);
  if (!knotMatch) return null; // dhurrie/flat-weave — no rate given in the source sheet
  const knotCount = Number(knotMatch[1]);
  const ratePerDay = knotCount < 6 ? 3 : knotCount <= 9 ? 2 : knotCount <= 11 ? 1.5 : 1;

  const dimFt = maxDimensionFt(size);
  if (dimFt === null) return null;
  return Math.ceil((dimFt * 12) / ratePerDay);
}

/** Standard days per current ERP status, matched by a regex against the raw status
 * text — case-insensitive, first match wins (order matters: more specific patterns
 * first). `priority0Days` applies only to priority-0 orders (rush orders get a tighter
 * standard on that one status); everyone else uses `days`. */
const STATUS_TAT_RULES: { pattern: RegExp; days: number; priority0Days?: number }[] = [
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

/** The one true entry point — everything else in this file is a helper for this.
 * `onHold` orders are excluded entirely (there's no "standard" for a stalled order),
 * matching the live-preview prototype's own rule. */
export function stageStandard(order: {
  rawCurrentStatus: string | null;
  quality: string | null;
  size: string | null;
  stdCubage: number | null;
  orderPriority: number | null;
  onHold: string | null;
  currentStatusPendingDays: number | null;
  /** Only used by loomFallbackStandardDays above — every other rule ignores it. */
  revisedExFactoryDate: string | null;
}): StageStandardResult {
  const isOnHold = Boolean(order.onHold && order.onHold.trim() && !/^(0|no)$/i.test(order.onHold.trim()));
  if (isOnHold) return { status: "on_hold", standardDays: null, overBy: null };

  let standardDays: number | null;
  if (isSwatch(order.stdCubage)) {
    standardDays = SAMPLE_TOTAL_DAYS;
  } else if (order.rawCurrentStatus && /loom/i.test(order.rawCurrentStatus) && !/preloom|pre-loom/i.test(order.rawCurrentStatus)) {
    standardDays =
      loomStandardDays(order.quality, order.size) ??
      loomFallbackStandardDays(order.revisedExFactoryDate, order.currentStatusPendingDays ?? 0);
  } else {
    const rule = order.rawCurrentStatus
      ? STATUS_TAT_RULES.find((r) => r.pattern.test(order.rawCurrentStatus!))
      : undefined;
    standardDays = rule ? (order.orderPriority === 0 && rule.priority0Days !== undefined ? rule.priority0Days : rule.days) : null;
  }

  if (standardDays === null) return { status: "no_standard", standardDays: null, overBy: null };

  const pendingDays = order.currentStatusPendingDays ?? 0;
  if (pendingDays > standardDays) {
    return { status: "breached", standardDays, overBy: pendingDays - standardDays };
  }
  return { status: "within", standardDays, overBy: null };
}
