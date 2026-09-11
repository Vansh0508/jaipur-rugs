import type { SupabaseClient } from "@supabase/supabase-js";
import type { Tables } from "@jaipur-rugs/supabase-client";
import { STOCK_CUSTOMER_CODES, SWATCH_MAX_SQFT, toList } from "./orders";

// RugLens — "what open-stock samples/rugs do we actually have, and where, and what do
// they look like." Built 2026-09-10 from a direct Ayaan voice note: Atlas's `orders`
// table already carries the exact rows this needs (design/GR/BR/location/PO/on-hold
// all already columns — see db/orders/001_orders_core_schema.sql and 013), so this is a
// new *view* over `orders`, not a new table. It's the mirror image of
// STOCK_CUSTOMER_CODES's normal use: every other view in this app EXCLUDES those 5
// customer codes as not-real-orders; RugLens is the one place that deliberately
// INCLUDES only them, because that's exactly what marks a row as warehouse
// stock/sample inventory rather than a real customer order.
//
// "Available" here means: an open-stock row (STOCK_CUSTOMER_CODES) with no Customer PO
// and not on hold — confirmed directly, 2026-09-10: a stock row with either of those
// set is spoken for / paused, not free to show someone. There's no separate "Hold
// Remarks" column in `orders` (only the raw `on_hold` ERP value — see orders.ts's
// onHold filter comment, and ERP_AND_EXTERNAL_REQUESTS.md's note that a real freetext
// remarks field doesn't exist yet on Atlas's side) — "Hold Remarks blank" is
// implemented as "on_hold blank," the closest real field, using the exact same
// yes/no truthy rule the Orders page's own On Hold filter already uses so the two
// never quietly disagree about what "on hold" means.
//
// That "available" condition is the DEFAULT view, not an absolute — direct feedback,
// 2026-09-11: sometimes someone deliberately wants to check what's on hold or already
// has a Customer PO too, just not have that mixed into the everyday view by default.
// See RugLensFilters.includeHeldOrAssigned below.

// Final-location classification — direct feedback, 2026-09-11: "keep the final
// location only such as stores, showroom, finished locations, warehouse. Not like
// unfinished, consignee, repair, rejected, inspection, and more such locations."
// current_location is free text straight from the NAV sync (see
// db/orders/013_nav_direct_fields.sql) — no controlled vocabulary — so this is a
// keyword classification, checked directly against the real live distinct values
// (not guessed): an INCLUDE set (broad, catches most of the real "final" locations)
// combined with an EXCLUDE set that overrides it. The exclude set is load-bearing, not
// decorative — checked live: "godown" alone as an include keyword (to catch "Palana
// Godown") also matched "Surana Unfinished Godown" and "Sadwa Godown (Recd frm
// Repair)", both clearly NOT final locations, until the matching exclude keywords
// ("unfinished", "repair") were added to override it. Include-keywords alone are not
// reliable here; exclude always wins.
const FINAL_LOCATION_INCLUDE_KEYWORDS = ["warehouse", "showroom", "store", "whse", "godown", "branch", "finished"];
const FINAL_LOCATION_EXCLUDE_KEYWORDS = [
  "unfinished", "consignee", "repair", "reject", "inspection", "return", "rework",
  "production", "dyeing", "washing", "packing", "rafoo", "thukai", "finishing",
];
// Real location names, confirmed directly with Ayaan, 2026-09-11 — don't match any
// include keyword above but are genuine final locations (branch/office addresses with
// no distinguishing common word): "Jaipur Rugs Co. Ltd. (Empire Complex, Mumbai)"
// (1,077 stock rows — by far the largest of the three), "Jaipur Rugs - Koregaon Park,
// PUNE" (352), "JRCPL Raipur, CG" (303).
const FINAL_LOCATION_EXACT_INCLUDES = [
  "Jaipur Rugs Co. Ltd. (Empire Complex, Mumbai)",
  "Jaipur Rugs - Koregaon Park, PUNE",
  "JRCPL Raipur, CG",
];

export type RugLensRow = Tables<"orders">;

export type RugLensItemType = "sample" | "rug";

export interface RugLensFilters {
  /** Current location (warehouse/showroom), exact multi-select — same semantics as
   * every other facet filter in this app: a row matches if its current_location is ANY
   * of the given ones. Free text sourced straight from the NAV sync (current_location),
   * not a controlled vocabulary — see listRugLensLocations for the real distinct list. */
  location?: string | string[];
  /** Exact multi-select, same semantics as location above. */
  quality?: string | string[];
  /** Corrected 2026-09-11, direct feedback: originally a Serial No_ prefix rule ("SS" =
   * sample) — now the same std_cubage-based "swatch" size classification Orders' own
   * Construction filter already uses (see SWATCH_MAX_SQFT and applyRugLensFilters'
   * itemType handling below), so RugLens and Orders can't disagree about what counts
   * as a sample. */
  itemType?: RugLensItemType;
  /** Free-text search across every column RugLens actually shows (Design, GR/BR Color,
   * Quality, Size, Location, Item No., Serial No., Customer Code, Customer PO, Hold
   * Remarks) — a row matches if ANY of them contains the term, case-insensitive. Same
   * broad-OR-across-fields approach as Orders' own `search` filter. */
  search?: string;
  /** Opt-in escape hatch, direct feedback 2026-09-11: "give an option ... to check
   * hold remarks or customer PO mentioned items also but not in default view." Default
   * (false/unset) keeps the normal PO-blank/not-on-hold "available" condition; true
   * drops both restrictions entirely, so a row that's on hold or already has a
   * Customer PO shows up too — someone deliberately checking what's spoken for, not
   * the everyday "what can I offer" view. */
  includeHeldOrAssigned?: boolean;
  page?: number;
  pageSize?: number;
}

export interface RugLensListResult {
  rows: RugLensRow[];
  totalCount: number;
}

export const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 50;

/** The "available open stock" condition, shared by the list query and the location-facet
 * query below so they can never quietly drift apart (same reasoning as orders.ts's
 * applyOrderFilters). Takes an already-`.select()`ed query (supabase-js requires select()
 * before any filter method changes the builder's type) and returns it with every
 * RugLens condition chained on. */
function applyRugLensFilters(query: any, filters: RugLensFilters) {
  query = query
    .in("customer_no", STOCK_CUSTOMER_CODES)
    // Final-location baseline — see FINAL_LOCATION_* above. The include side is one
    // .or() (composes as an AND-of-OR-group with everything else, same reasoning as
    // the PO/hold .or() calls below); the exclude side is a plain AND per keyword
    // (.not(), not another .or()) since every one of them must hold, not just any one.
    .or(
      [
        ...FINAL_LOCATION_INCLUDE_KEYWORDS.map((kw) => `current_location.ilike.%${kw}%`),
        ...FINAL_LOCATION_EXACT_INCLUDES.map((loc) => `current_location.eq."${loc}"`),
      ].join(","),
    );
  for (const keyword of FINAL_LOCATION_EXCLUDE_KEYWORDS) {
    query = query.not("current_location", "ilike", `%${keyword}%`);
  }

  // The "available" restriction — skipped entirely when includeHeldOrAssigned is set
  // (see that field's doc comment). Two separate .or() calls compose as AND-of-two-OR-
  // groups — PostgREST ANDs same-named query params together (repeated `or=` params),
  // so this reads as "(PO is blank) AND (not on hold)," each side itself an OR across
  // the different raw-value shapes that count as "blank"/"not set."
  if (!filters.includeHeldOrAssigned) {
    query = query
      .or("customer_po_no.is.null,customer_po_no.eq.")
      .or("on_hold.is.null,on_hold.in.(,0,No,no,NO)");
  }

  const locations = toList(filters.location);
  if (locations.length) query = query.in("current_location", locations);

  const qualities = toList(filters.quality);
  if (qualities.length) query = query.in("quality", qualities);

  // "Sample" = a swatch by size, not by serial number — same rule Orders' own
  // Construction filter uses for ctype="swatch" (Std Cubage > 0 and < SWATCH_MAX_SQFT
  // sq ft). "Rug" is everything else, including a NULL std_cubage (has to be spelled
  // out explicitly: NULL matches neither "< 4" nor "not < 4" under SQL's normal
  // null-is-neither-true-nor-false comparison rules, so without this branch a row with
  // no Std Cubage would silently vanish from both filter options).
  if (filters.itemType === "sample") query = query.gt("std_cubage", 0).lt("std_cubage", SWATCH_MAX_SQFT);
  if (filters.itemType === "rug") query = query.or(`std_cubage.lte.0,std_cubage.gte.${SWATCH_MAX_SQFT},std_cubage.is.null`);

  if (filters.search) {
    const term = `%${filters.search}%`;
    query = query.or(
      [
        "design", "gr_color_name", "br_color_name", "quality", "size", "current_location",
        "item_no", "serial_no", "customer_no", "customer_po_no", "on_hold",
      ]
        .map((field) => `${field}.ilike.${term}`)
        .join(","),
    );
  }

  return query;
}

/** RLS already scopes which rows come back (see requireRugLensAccess.ts and
 * private.can_view_order() — a Sales department grant already resolves correctly there;
 * a Back Ops grant will too as soon as that department is wired into can_view_order(),
 * not before). This just applies RugLens's own filters on top, with real pagination. */
export async function listOpenStock(supabase: SupabaseClient, filters: RugLensFilters = {}): Promise<RugLensListResult> {
  let query = applyRugLensFilters(supabase.from("orders").select("*", { count: "exact" }), filters).order(
    "current_location",
    { ascending: true, nullsFirst: false },
  ).order("design", { ascending: true, nullsFirst: false });

  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE;
  const page = Math.max(1, filters.page ?? 1);
  const from = (page - 1) * pageSize;
  query = query.range(from, from + pageSize - 1);

  const { data, error, count } = await query;
  if (error) throw error;
  return { rows: data ?? [], totalCount: count ?? 0 };
}

/** Distinct values for one column among rows that actually match the current
 * open-stock condition (not every value in the whole orders table) — so a filter
 * dropdown only ever offers options that would actually return something. Takes
 * `includeHeldOrAssigned` (not the rest of `filters`, deliberately — the Location/
 * Quality dropdowns themselves stay independent of each other, same as before) so the
 * options on offer widen correctly when that's turned on, rather than staying locked
 * to the plain-available set. Same paginated-dedupe-in-JS approach as listOrderFacets,
 * for the same reason (PostgREST caps a single request at 1000 rows; fine at today's
 * scale). Shared by listRugLensLocations/listRugLensQualities below so they can't
 * drift apart. */
async function listRugLensFacetValues(
  supabase: SupabaseClient,
  column: "current_location" | "quality",
  includeHeldOrAssigned = false,
): Promise<string[]> {
  const values = new Set<string>();
  const PAGE_SIZE = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await applyRugLensFilters(supabase.from("orders").select(column), { includeHeldOrAssigned }).range(
      from,
      from + PAGE_SIZE - 1,
    );
    if (error) throw error;
    for (const row of (data ?? []) as Record<string, string | null>[]) {
      const value = row[column];
      if (value && value.trim().length) values.add(value.trim());
    }
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return [...values].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

export function listRugLensLocations(supabase: SupabaseClient, includeHeldOrAssigned = false): Promise<string[]> {
  return listRugLensFacetValues(supabase, "current_location", includeHeldOrAssigned);
}

export function listRugLensQualities(supabase: SupabaseClient, includeHeldOrAssigned = false): Promise<string[]> {
  return listRugLensFacetValues(supabase, "quality", includeHeldOrAssigned);
}
