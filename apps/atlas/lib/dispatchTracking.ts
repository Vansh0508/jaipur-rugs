// Real, top-level tracking pages for the couriers real orders actually go through —
// confirmed live against NAV's own Shipping Agent master table, 2026-09-15 ("MH-001" ->
// FedEx, "MH-004" -> Blue Dart, "RJ-007" -> DHL Express). Deliberately the courier's own
// plain tracking page, NOT a pre-filled deep link with the AWB baked into the URL —
// every deep-link query-param pattern tried against the real courier sites either
// failed outright or couldn't be confirmed working, so the real tracking number should
// be shown as plain, copyable text next to the link rather than a guessed URL that
// might silently send someone to a broken page. Matched on the resolved courier NAME
// (not the raw NAV code, which is really a state+sequence code, not a stable courier
// identity) — see orders-sync.mjs's syncTrackingInfo for where shipping_agent_name gets
// resolved from that code.
//
// Shared between OrdersTable.tsx (client) and orders/[id]/page.tsx (server) so this
// mapping only lives in one place — see ERP_AND_EXTERNAL_REQUESTS.md request #9 for the
// full investigation this came out of.
const KNOWN_COURIER_TRACKING_URLS: { match: RegExp; url: string }[] = [
  { match: /fedex/i, url: "https://www.fedex.com/en-us/tracking.html" },
  { match: /blue\s*dart/i, url: "https://www.bluedart.com/tracking" },
  { match: /\bdhl\b/i, url: "https://www.dhl.com/in-en/home/tracking.html" },
];

export function knownCourierTrackingUrl(shippingAgentName: string | null): string | null {
  if (!shippingAgentName) return null;
  return KNOWN_COURIER_TRACKING_URLS.find((c) => c.match.test(shippingAgentName))?.url ?? null;
}
