type QualityType = "knotted" | "tufted";

interface ZoneRule {
  knotted: string;
  tufted: string;
}

const ZONE_RULES: Record<string, { any?: ZoneRule; gt0?: ZoneRule; eq0?: ZoneRule }> = {
  SAMPLE: { gt0: { knotted: "Surendra", tufted: "Avinash Kumar" }, eq0: { knotted: "Mariyam", tufted: "Chandan Bind" } },
  MAKE2STOCK: { any: { knotted: "Surendra", tufted: "Avinash Kumar" } },
  JLI: { gt0: { knotted: "Avinash Joshi", tufted: "Avinash Kumar" }, eq0: { knotted: "Parthmesh", tufted: "Shehbaaz" } },
  "BIG BOX": { gt0: { knotted: "Surendra", tufted: "Avinash Kumar" }, eq0: { knotted: "Mariyam", tufted: "Chandan Bind" } },
  B2B: { gt0: { knotted: "Khusboo", tufted: "Avinash Kumar" }, eq0: { knotted: "Mariyam", tufted: "Chandan Bind" } },
  B2C: { any: { knotted: "Parthmesh", tufted: "Shehbaaz" } },
  EXHIBITION: { gt0: { knotted: "Surendra", tufted: "Avinash Kumar" }, eq0: { knotted: "Mariyam", tufted: "Chandan Bind" } },
  SUBSIDIARY: { any: { knotted: "Parthmesh", tufted: "Shehbaaz" } },
  ARCHIVE: { any: { knotted: "Surendra", tufted: "Avinash Kumar" } },
};

const JLI_ZERO_PRIORITY_CUSTOMER_1081: ZoneRule = { knotted: "Mariyam", tufted: "Chandan Bind" };

function classifyQuality(quality: string | null): QualityType | null {
  if (!quality) return null;
  if (/\d+\s*\/\s*\d+/.test(quality)) return "knotted";
  if (/tufted/i.test(quality)) return "tufted";
  return null;
}

export interface FollowUpPersonInput {
  rawCurrentStatus: string | null;
  quality: string | null;
  customerServiceZone: string | null;
  orderPriority: number | null;
  customerNo: string | null;
}

export function resolveFollowUpPerson(order: FollowUpPersonInput): string | null {
  if (order.rawCurrentStatus && /purchase/i.test(order.rawCurrentStatus)) return "Pramod Kumar Mourya";
  if (order.quality && /ultra\s*pro/i.test(order.quality)) return "narendra";

  const qType = classifyQuality(order.quality);
  if (!qType) return null;

  if (!order.customerServiceZone) return null;
  const zone = order.customerServiceZone.trim().toUpperCase();

  if (zone === "JLI" && order.orderPriority === 0 && order.customerNo?.trim() === "1081") {
    return JLI_ZERO_PRIORITY_CUSTOMER_1081[qType];
  }

  const rule = ZONE_RULES[zone];
  if (!rule) return null;
  const bucket = rule.any ?? (order.orderPriority === null ? undefined : order.orderPriority === 0 ? rule.eq0 : rule.gt0);
  if (!bucket) return null;
  return bucket[qType];
}
