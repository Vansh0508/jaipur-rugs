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

/** Exact per-quality knotting rate (inches/day), zero-priority orders only — confirmed
 * directly by production, 2026-09-07 ("Zero Priority Per Day Standard Work.xlsx"). More
 * precise than the tiered fallback below where a quality is listed here by its exact
 * string (e.g. "8/8" -> 3, not the tiered guess of 2) — production's own numbers don't
 * follow the tiered pattern cleanly (e.g. "3/16" -> 8, well outside what a <6-knot tier
 * would suggest), so this is a real lookup, not a formula. Non-zero-priority orders, and
 * any zero-priority quality not listed here, still use the tiered fallback further down
 * — production said the non-zero-priority numbers are a separate sheet, not yet given. */
const ZERO_PRIORITY_KNOTTED_RATE: Record<string, number> = {
  "3/16": 8, "3/20": 8, "3/25": 8, "4/25": 6, "5/5": 6, "6.5/36": 6, "6/5": 6, "6/6": 4,
  "6/8": 5.5, "8/8": 3, "9/9": 2.25, "10/10": 2, "10/14": 2, "11/11": 1.75, "14/14": 1,
  "7/7": 4, "9/7": 3, "5/16": 7, "3.5/18": 10, "4/15": 10, "3/12": 10, "4/22": 10,
  "3/13": 10, "3.5/22": 10, "7/22": 6, "3.5/18 WL": 10, "8/6": 5.5, "2.5/14": 10,
  "6/20": 6, "5/15": 6, "6/4": 6, "3/7": 8, "5/25": 7, "3/15": 8, "5/22": 7, "5/21": 7,
  "3.5/25": 8, "3/10": 8, "5.5/30": 8, "5/32": 8, "4.25/30": 8, "5/35": 8,
};

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
 * quality. Handloom and Dhurrie/flat-weave both get a flat 12 days — confirmed directly
 * by production, 2026-09-07 ("handloom and flatweave both should use the same 12-day
 * standard as Tufted"), replacing Handloom's old flat 8 and flat-weave's old "no
 * standard at all" (which used to fall back to a purely date-driven interim rule, now
 * removed — every quality has a real number as of this rule). Knotted qualities (a
 * quality string containing an `n/m` knot-count pattern, e.g. "8/8") get a real rate:
 * for zero-priority orders, an exact per-quality lookup where production gave one
 * (`ZERO_PRIORITY_KNOTTED_RATE`); otherwise (non-zero priority, or a zero-priority
 * quality not in that table) a coarser tiered guess by the first knot-count number,
 * finer knotting assumed slower — production said the real non-zero-priority numbers
 * are a separate, not-yet-provided sheet. */
function loomStandardDays(quality: string | null, size: string | null, orderPriority: number | null): number | null {
  if (!quality) return null;
  if (/handloom/i.test(quality)) return 12;
  if (/tufted/i.test(quality)) return 12;

  const knotMatch = quality.match(/(\d+(?:\.\d+)?)\s*\/\s*\d+(?:\.\d+)?(?:\s+\S+)?/);
  if (!knotMatch) return 12; // dhurrie/flat-weave — same flat standard as Tufted/Handloom

  const dimFt = maxDimensionFt(size);
  if (dimFt === null) return null;

  let ratePerDay: number | undefined;
  if (orderPriority === 0) {
    // Try the full trimmed quality string first (the source table sometimes keys a
    // suffixed variant separately, e.g. "3.5/18 WL" has its own rate distinct from
    // "3.5/18"), then fall back to just the bare "N/M" prefix (real quality strings
    // often carry an extra color/finish suffix like "8/8 RWB" that this table doesn't
    // enumerate individually).
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

/** Standard days per current ERP status, matched by a regex against the raw status
 * text — case-insensitive, first match wins (order matters: more specific patterns
 * first). `priority0Days` applies only to priority-0 orders; everyone else uses `days`.
 * Updated 2026-09-07 from production's own edits to "Atlas_Current_TAT_Rules.xlsx"'s
 * Status-based TAT tab — Branch/In Transit/Repair/Finishing/Order Process all changed
 * from what was here before.
 *
 * Design and PPC deliberately left unchanged — production's edits for these two came
 * back as text that can't be safely turned into one number ("7 for rug 3 days for
 * swatches" mixes two different cases in one cell; "1-2 Days" is a range, not a value),
 * so guessing which number to use risked getting it wrong rather than just leaving the
 * existing one in place. Flagged for Ayaan to get a single clarified number for each. */
const STATUS_TAT_RULES: { pattern: RegExp; days: number; priority0Days?: number }[] = [
  { pattern: /order\s*process/i, days: 2, priority0Days: 2 },
  { pattern: /design/i, days: 15, priority0Days: 7 }, // unchanged — see comment above
  { pattern: /ppc/i, days: 1 }, // unchanged — see comment above
  { pattern: /stores?/i, days: 10, priority0Days: 12 },
  { pattern: /branch/i, days: 10, priority0Days: 7 },
  { pattern: /in[\s-]*transit/i, days: 10, priority0Days: 7 },
  { pattern: /repair/i, days: 2, priority0Days: 3 },
  { pattern: /finish(ing)?/i, days: 15, priority0Days: 10 },
  { pattern: /check(ing)?|inspection/i, days: 2, priority0Days: 2 },
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
    standardDays = loomStandardDays(order.quality, order.size, order.orderPriority);
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
