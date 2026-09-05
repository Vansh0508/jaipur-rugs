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
}): StageStandardResult {
  const isOnHold = Boolean(order.onHold && order.onHold.trim() && !/^(0|no)$/i.test(order.onHold.trim()));
  if (isOnHold) return { status: "on_hold", standardDays: null, overBy: null };

  let standardDays: number | null;
  if (isSwatch(order.stdCubage)) {
    standardDays = SAMPLE_TOTAL_DAYS;
  } else if (order.rawCurrentStatus && /loom/i.test(order.rawCurrentStatus) && !/preloom|pre-loom/i.test(order.rawCurrentStatus)) {
    standardDays = loomStandardDays(order.quality, order.size);
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
