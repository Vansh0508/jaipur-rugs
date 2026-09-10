import type { SupabaseClient } from "@supabase/supabase-js";
import type { Tables } from "@jaipur-rugs/supabase-client";
import { STOCK_CUSTOMER_CODES, toList } from "./orders";

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

export type RugLensRow = Tables<"orders">;

export type RugLensItemType = "sample" | "rug";

export interface RugLensFilters {
  /** Current location (warehouse/showroom), exact multi-select — same semantics as
   * every other facet filter in this app: a row matches if its current_location is ANY
   * of the given ones. Free text sourced straight from the NAV sync (current_location),
   * not a controlled vocabulary — see listRugLensLocations for the real distinct list. */
  location?: string | string[];
  /** Confirmed directly, 2026-09-10: a Serial No_ starting with "SS" is a sample, not a
   * full rug — see applyRugLensFilters' itemType handling for the exact SQL (has to
   * handle NULL serials explicitly, or they'd silently vanish from BOTH options under
   * SQL's normal null-is-neither-true-nor-false comparison rules). */
  itemType?: RugLensItemType;
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
    // Two separate .or() calls compose as AND-of-two-OR-groups — PostgREST ANDs
    // same-named query params together (repeated `or=` params), so this reads as
    // "(PO is blank) AND (not on hold)," each side itself an OR across the different
    // raw-value shapes that count as "blank"/"not set."
    .or("customer_po_no.is.null,customer_po_no.eq.")
    .or("on_hold.is.null,on_hold.in.(,0,No,no,NO)");

  const locations = toList(filters.location);
  if (locations.length) query = query.in("current_location", locations);

  // "Sample" = Serial No_ starts with "SS" (case-insensitive). A NULL serial_no matches
  // NEITHER `ilike 'SS%'` NOR `not.ilike.SS%` under normal SQL null comparison rules
  // (both come back UNKNOWN, not true) — without the explicit `.is.null` branch on the
  // "rug" side, a row with no serial number would silently disappear from both filter
  // options instead of counting as "not a sample."
  if (filters.itemType === "sample") query = query.ilike("serial_no", "SS%");
  if (filters.itemType === "rug") query = query.or("serial_no.is.null,serial_no.not.ilike.SS%");

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

/** Distinct current_location values among rows that actually match the open-stock/
 * PO-blank/not-on-hold condition (not every location in the whole orders table) — so the
 * Location filter only ever offers options that would actually return something. Same
 * paginated-dedupe-in-JS approach as listOrderFacets, for the same reason (PostgREST
 * caps a single request at 1000 rows; fine at today's scale). */
export async function listRugLensLocations(supabase: SupabaseClient): Promise<string[]> {
  const values = new Set<string>();
  const PAGE_SIZE = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await applyRugLensFilters(supabase.from("orders").select("current_location"), {}).range(
      from,
      from + PAGE_SIZE - 1,
    );
    if (error) throw error;
    for (const row of (data ?? []) as { current_location: string | null }[]) {
      if (row.current_location && row.current_location.trim().length) values.add(row.current_location.trim());
    }
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return [...values].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}
