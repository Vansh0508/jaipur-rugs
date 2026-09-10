// Follow Up Person — computed from the real Zone x Priority x Quality-type routing
// table Ayaan provided directly ("Ex India.xlsx", Sheet2), NOT from orders.follow_up_person
// (NAV's own raw text field). Explicit instruction, 2026-09-07: "dont take NAV data for
// follow up person. refer to only [Ex India.xlsx]". Ported 1:1 from that sheet's own
// rows — every zone/condition/name below is a direct transcription, not a guess. Matches
// what was already documented (and confirmed correct) in ERP_AND_EXTERNAL_REQUESTS.md
// request #4, now actually implemented for the Orders table's display column.
//
// This is display/copy-convenience only — NOT the automated delay-alert routing, which
// stays unbuilt pending a second confirmation with production (same request #4).

type QualityType = "knotted" | "tufted";

interface ZoneRule {
  knotted: string;
  tufted: string;
}

/** zone (upper-cased, trimmed) -> priority bucket -> names. `any` means the sheet gives
 * one rule regardless of priority (MAKE2STOCK, B2C, SUBSIDIARY, ARCHIVE); otherwise
 * `gt0`/`eq0` split on Order Priority > 0 vs. = 0. "GROUP CO." is deliberately absent —
 * the sheet's own note for it is "Will update manual", not a real rule yet. */
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

/** JLI, zero priority, customer 1081 — the sheet's one named-customer exception, overriding
 * the regular JLI-zero-priority row (Parthmesh/Shehbaaz) with the Sample-zero-priority pair
 * instead (Mariyam/Chandan Bind). */
const JLI_ZERO_PRIORITY_CUSTOMER_1081: ZoneRule = { knotted: "Mariyam", tufted: "Chandan Bind" };

/** Quality types the sheet actually has a Knotted/Tufted rule for. Confirmed live
 * 2026-09-07: Handloom qualities (Handloom, Handloom Double Back, Handloom Viscose —
 * 1,166 real orders) aren't Knotted or Tufted and have no column in the sheet at all —
 * a real gap in the source routing table itself, not a parsing miss here. Dhurrie/
 * Accessories/Shag/etc. are the same situation. */
function classifyQuality(quality: string | null): QualityType | null {
  if (!quality) return null;
  if (/\d+\s*\/\s*\d+/.test(quality)) return "knotted"; // e.g. "8/8" — a real knot count
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

/** Returns the computed name, or null if no rule in the sheet covers this order — never
 * guessed. Order of checks matches the sheet's own structure: Purchase-stage and
 * Ultra-Pro-quality are flat overrides that beat every zone/priority row (every row in
 * the sheet repeats the same "Pramod Kumar Mourya" / "If quality Pro Then narendra" in
 * their own columns), checked before anything zone-specific. */
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
  if (!rule) return null; // e.g. "GROUP CO." — no rule defined in the sheet yet
  const bucket = rule.any ?? (order.orderPriority === null ? undefined : order.orderPriority === 0 ? rule.eq0 : rule.gt0);
  if (!bucket) return null;
  return bucket[qType];
}
