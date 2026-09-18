// "Stage standard" — how many days the order's CURRENT stage/status is normally
// expected to take, so it can sit next to the actual "Days in Stage" figure as a real
// comparison ("standard says 10d, you're at 34d"). Ported from Atlas orders.

export type StageStandardStatus = "breached" | "within" | "no_standard" | "on_hold";

export interface StageStandardResult {
  status: StageStandardStatus;
  standardDays: number | null;
  /** How many days over the standard, only set when status is "breached". */
  overBy: number | null;
}

const SWATCH_MAX_SQFT = 4;
const SAMPLE_TOTAL_DAYS = 15;

function isSwatch(stdCubage: number | null): boolean {
  return stdCubage !== null && stdCubage > 0 && stdCubage < SWATCH_MAX_SQFT;
}

const ZERO_PRIORITY_KNOTTED_RATE: Record<string, number> = {
  "3/16": 8, "3/20": 8, "3/25": 8, "4/25": 6, "5/5": 6, "6.5/36": 6, "6/5": 6, "6/6": 4,
  "6/8": 5.5, "8/8": 3, "9/9": 2.25, "10/10": 2, "10/14": 2, "11/11": 1.75, "14/14": 1,
  "7/7": 4, "9/7": 3, "5/16": 7, "3.5/18": 10, "4/15": 10, "3/12": 10, "4/22": 10,
  "3/13": 10, "3.5/22": 10, "7/22": 6, "3.5/18 WL": 10, "8/6": 5.5, "2.5/14": 10,
  "6/20": 6, "5/15": 6, "6/4": 6, "3/7": 8, "5/25": 7, "3/15": 8, "5/22": 7, "5/21": 7,
  "3.5/25": 8, "3/10": 8, "5.5/30": 8, "5/32": 8, "4.25/30": 8, "5/35": 8,
};

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

function loomStandardDays(quality: string | null, size: string | null, orderPriority: number | null): number | null {
  if (!quality) return null;
  if (/handloom/i.test(quality)) return 12;
  if (/tufted/i.test(quality)) return 12;

  const knotMatch = quality.match(/(\d+(?:\.\d+)?)\s*\/\s*\d+(?:\.\d+)?(?:\s+\S+)?/);
  if (!knotMatch) return 12;

  const dimFt = maxDimensionFt(size);
  if (dimFt === null) return null;

  let ratePerDay: number | undefined;
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

const STATUS_TAT_RULES: { pattern: RegExp; days: number; priority0Days?: number }[] = [
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
