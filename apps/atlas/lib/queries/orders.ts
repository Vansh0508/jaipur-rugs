import type { SupabaseClient } from "@supabase/supabase-js";
import type { Tables } from "@jaipur-rugs/supabase-client";

// Deliberately typed as a plain (un-generic'd) SupabaseClient, not SupabaseClient
// — same convention as apps/hub/lib/queries/*.ts. packages/auth's client factories return
// plain SupabaseClient (they're framework-agnostic, shared across every app's schema
// needs), so constraining the parameter here to <Database> would fight that at every
// call site for no real type-safety gain; Tables<'x'> below is what keeps return shapes honest.

export type OrderRow = Tables<"orders">;
export type StageRow = Tables<"stages">;
export type StageEventRow = Tables<"order_stage_events">;
export type ShippingDetailRow = Tables<"shipping_details">;

/** These 5 customer codes are internal warehouse stock/inventory, not real customer
 * orders — the same 5 the pre-Atlas tool (ai.jaipurrugs.com/track-jr-order/) already
 * excluded from every normal view for the same reason. Confirmed live 2026-09-03: never
 * carried over into Atlas, so 3,479 of the 14,214 rows then in `orders` (24.5%) were
 * stock rows being counted as real customer orders on the Dashboard. Stored zero-padded
 * to 4 digits in the real feed (confirmed against live data), not bare numbers.
 * Excluded by default everywhere below (`includeStock` opts back in) rather than
 * dropped at sync time, so the data stays queryable later if a dedicated stock/
 * inventory view is ever built, matching the old tool's own design. */
export const STOCK_CUSTOMER_CODES = ["0277", "0177", "0877", "0322", "0108"];

/** All stages, ordered for the timeline/nav — small reference table, safe to fetch in full. */
export async function listStages(supabase: SupabaseClient): Promise<StageRow[]> {
  const { data, error } = await supabase.from("stages").select("*").order("display_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// Page sizes offered on the Orders list. Changed 2026-09-10 to 20/50/100/500 per direct
// request (was 25/50/100, direct feedback 2026-09-07) — 500 stays available for anyone
// who really wants one big page despite the heavier fetch; the table itself keeps its
// column-resize handles rather than switching to a virtualized (fixed-width) rendering
// mode to handle that size smoothly, a deliberate trade-off (Hero UI's virtualizer and
// this table's drag-to-resize columns are mutually exclusive — confirmed against its
// type definitions), so a 500-row page is fully usable, just not quite as buttery a
// scroll as a virtualized list would be.
export const PAGE_SIZE_OPTIONS = [20, 50, 100, 500] as const;
export const DEFAULT_PAGE_SIZE = 20;

export type ConstructionType = "knotted" | "tufted" | "handloom" | "other" | "swatch";
export type AgingBucket = "0-7" | "8-15" | "16-30" | "30+";
export type DelayStatusFilter = "late" | "soon" | "late_or_soon";
export type YesNo = "yes" | "no";

export interface OrderFilters {
  /** Broad free-text search — mirrors the old tool's "search the whole row," just over
   * the specific fields it's most useful against rather than the literal whole JSON row:
   * OTN, Item No., Sales Order No., Customer No., Merchant, Order-Wise Merchant,
   * Customer PO No., Quality, Design, Size, Follow-up Person, raw ERP status. */
  search?: string;
  /** Every field below is an exact multi-select, same semantics as the old tool's
   * comma-list filters (matchMulti) — a row matches if its value is ANY of the given
   * ones. Accepts a single value or an array (a plain <select multiple> submits an
   * array of same-named query params, which Next.js's searchParams already gives you
   * as string[] — no comma-splitting needed on this end). */
  stageId?: string | string[];
  customerNo?: string | string[];
  merchantName?: string | string[];
  orderWiseMerchant?: string | string[];
  followUpPerson?: string | string[];
  customerPoNo?: string | string[];
  quality?: string | string[];
  design?: string | string[];
  size?: string | string[];
  productionOrderStatus?: string | string[];
  priority?: string | string[];
  /** Bucketed by current_status_pending_days — see AgingBucket. A row with no pending-
   * days value is excluded whenever this filter is set, same as the old tool (there's
   * no "unknown" bucket to opt into). */
  aging?: AgingBucket;
  onHold?: YesNo;
  quickShip?: YesNo;
  /** Computed against revised_ex_factory_date, not promised_delivery_date — confirmed
   * against the live feed that promised_delivery_date is essentially always blank (see
   * the live-preview prototype's own finding, same ERP feed); revised_ex_factory_date is
   * the real signal every delay computation in this app already uses. "Late"/"soon" are
   * meaningless once an order has reached a terminal stage, so those are excluded too —
   * requires `terminalStageIds` (compute once from listStages() and pass through). */
  delayStatus?: DelayStatusFilter;
  terminalStageIds?: string[];
  /** Date range on revised_ex_factory_date (yyyy-mm-dd strings). */
  dueFrom?: string;
  dueTo?: string;
  /** Construction-type classification, same rules as the old tool: knotted = Quality
   * contains a "/" (e.g. "8/8"), tufted/handloom = Quality contains that word, "swatch"
   * overrides all of the above (Std Cubage > 0 and < 4 sq ft — a sample, not a rug), and
   * "other" is none of the above. */
  ctype?: ConstructionType;
  /** 1-based page number, paired with pageSize — see PAGE_SIZE_OPTIONS. */
  page?: number;
  pageSize?: number;
  /** Legacy escape hatch for callers that just want "the first N, no real pagination"
   * (e.g. the Dashboard's recent-orders-style uses elsewhere) — ignored if page/pageSize
   * are set. */
  limit?: number;
  /** Column to sort by — restricted to SORTABLE_COLUMNS (a plain user-facing key, not
   * a raw DB column name, so a request can never sort by an arbitrary/unintended
   * column). Defaults to updated_at desc (most-recently-synced first) when unset. */
  sortBy?: SortableColumn;
  sortDir?: "asc" | "desc";
  /** Include the 5 internal stock/inventory customer codes (see STOCK_CUSTOMER_CODES).
   * Defaults to false — they're excluded from every normal view, same as the old tool. */
  includeStock?: boolean;
}

export interface OrderListResult {
  rows: OrderRow[];
  /** Total rows matching the filters (before pagination) — powers "Showing X-Y of Z"
   * and the page-count. Comes from PostgREST's exact count on the same query, not a
   * second round trip. */
  totalCount: number;
}

// Exported — lib/queries/rugLens.ts reuses this exact threshold for its own
// Sample/Rug classification (std_cubage-based, not the serial-number-prefix rule it
// used at first), so the two "what counts as a swatch" definitions in this app can't
// quietly drift apart.
export const SWATCH_MAX_SQFT = 4;

/** Every column the Orders table lets someone sort by — a fixed whitelist mapping a
 * plain user-facing key to the real DB column, so a request can never sort by an
 * arbitrary column. Stage isn't here: a real attempt at sorting Stage by the joined
 * stages.display_order didn't actually work in practice (confirmed live 2026-09-05) and
 * was removed rather than left silently broken — worth revisiting for real later.
 * Stage Standard (TAT) and On-Time also aren't here — both are computed, not stored
 * anywhere to sort by — see OrdersTable.tsx's client-side computedSort instead. Same
 * reason Delay (Orig. Ex-Factory) and Total Days aren't here either — both computed
 * client-side from original_ex_factory_date/sales_order_date, which already are
 * sortable in their own right (originalExFactory/salesOrderDate below). */
export const SORTABLE_COLUMNS = {
  otn: "otn_no",
  merchant: "merchant_name",
  customerPo: "customer_po_no",
  salesCode: "salesperson_code",
  salesPerson: "order_wise_merchant",
  design: "design",
  quality: "quality",
  size: "size",
  construction: "construction",
  pendingDays: "current_status_pending_days",
  originalExFactory: "original_ex_factory_date",
  salesOrderDate: "sales_order_date",
  revisedExFactory: "revised_ex_factory_date",
  revisedExIndia: "revised_ex_india_date",
  currentLocation: "current_location",
  // followUpPerson deliberately absent — the Orders table displays a *computed* value
  // (lib/followUpPerson.ts), not the raw orders.follow_up_person column, so sorting by
  // that raw field would silently not match what's shown. Same reasoning as Stage.
} as const;
export type SortableColumn = keyof typeof SORTABLE_COLUMNS;

/** Normalizes a filter value that might arrive as a single string or an array (a plain
 * <select multiple>'s query params, or a hand-built URL) into a clean string array.
 * Exported — lib/queries/rugLens.ts reuses this exact normalization rather than
 * redefining it, same reasoning as STOCK_CUSTOMER_CODES being exported above. */
export function toList(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  return (Array.isArray(value) ? value : [value]).map((v) => v.trim()).filter(Boolean);
}

/** ANDs the construction-type classification onto `query`. See OrderFilters.ctype's doc
 * for the exact rules — ported from the old tool / live-preview prototype's logic,
 * expressed as PostgREST filters rather than a client-side row-by-row check so it works
 * against the full table, not just whatever page happens to be loaded. */
function applyConstructionTypeFilter(query: any, ctype: ConstructionType) {
  const notSwatch = `std_cubage.lte.0,std_cubage.gte.${SWATCH_MAX_SQFT},std_cubage.is.null`;
  switch (ctype) {
    case "swatch":
      return query.gt("std_cubage", 0).lt("std_cubage", SWATCH_MAX_SQFT);
    case "knotted":
      return query.like("quality", "%/%").or(notSwatch);
    case "tufted":
      return query.ilike("quality", "%tufted%").or(notSwatch);
    case "handloom":
      return query.ilike("quality", "%handloom%").or(notSwatch);
    case "other":
      return query
        .not("quality", "like", "%/%")
        .not("quality", "ilike", "%tufted%")
        .not("quality", "ilike", "%handloom%")
        .or(notSwatch);
  }
}

/** Shared by listOrders/listOrderFacets — every "real customer order" view starts from
 * this same base: stock/inventory codes excluded (unless opted back in), every
 * multi-select applied as an exact IN-match, aging/on-hold/quick-ship/delay/date-range/
 * construction-type applied as their respective conditions. Kept as one function so the
 * facets query and the list query can never quietly drift out of sync with each other. */
function applyOrderFilters(supabase: SupabaseClient, filters: OrderFilters) {
  let query = supabase.from("orders").select("*", { count: "exact" });

  if (!filters.includeStock) query = query.not("customer_no", "in", `(${STOCK_CUSTOMER_CODES.join(",")})`);

  const stageIds = toList(filters.stageId);
  if (stageIds.length) query = query.in("stage_id", stageIds);

  const customerNos = toList(filters.customerNo);
  if (customerNos.length) query = query.in("customer_no", customerNos);

  const merchantNames = toList(filters.merchantName);
  if (merchantNames.length) query = query.in("merchant_name", merchantNames);

  const orderWiseMerchants = toList(filters.orderWiseMerchant);
  if (orderWiseMerchants.length) query = query.in("order_wise_merchant", orderWiseMerchants);

  const followUpPeople = toList(filters.followUpPerson);
  if (followUpPeople.length) query = query.in("follow_up_person", followUpPeople);

  const customerPoNos = toList(filters.customerPoNo);
  if (customerPoNos.length) query = query.in("customer_po_no", customerPoNos);

  const qualities = toList(filters.quality);
  if (qualities.length) query = query.in("quality", qualities);

  const designs = toList(filters.design);
  if (designs.length) query = query.in("design", designs);

  const sizes = toList(filters.size);
  if (sizes.length) query = query.in("size", sizes);

  const prodStatuses = toList(filters.productionOrderStatus);
  if (prodStatuses.length) query = query.in("production_order_status", prodStatuses);

  const priorities = toList(filters.priority);
  if (priorities.length) query = query.in("order_priority", priorities.map(Number).filter((n) => !Number.isNaN(n)));

  if (filters.aging) {
    const [minStr, maxStr] = { "0-7": ["0", "7"], "8-15": ["8", "15"], "16-30": ["16", "30"], "30+": ["31", null] }[
      filters.aging
    ];
    query = query.gte("current_status_pending_days", Number(minStr));
    if (maxStr) query = query.lte("current_status_pending_days", Number(maxStr));
  }

  // on_hold/quick_ship are stored as the raw ERP value (see orders-sync.mjs), not a
  // clean boolean — "yes" means genuinely set to something truthy, "no" means
  // null/empty/"0"/"no" (case-insensitive), same truthy rule orders-sync itself uses.
  if (filters.onHold === "yes") query = query.not("on_hold", "is", null).not("on_hold", "in", "(,0,No,no,NO)");
  if (filters.onHold === "no") query = query.or("on_hold.is.null,on_hold.in.(,0,No,no,NO)");
  if (filters.quickShip === "yes") query = query.eq("quick_ship", true);
  if (filters.quickShip === "no") query = query.eq("quick_ship", false);

  if (filters.delayStatus) {
    const today = new Date().toISOString().slice(0, 10);
    const in7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    query = query.not("revised_ex_factory_date", "is", null);
    if (filters.terminalStageIds?.length) query = query.not("stage_id", "in", `(${filters.terminalStageIds.join(",")})`);
    if (filters.delayStatus === "late") query = query.lt("revised_ex_factory_date", today);
    else if (filters.delayStatus === "soon") query = query.gte("revised_ex_factory_date", today).lte("revised_ex_factory_date", in7Days);
    else query = query.lte("revised_ex_factory_date", in7Days); // late_or_soon: <= today+7 covers both
  }

  if (filters.dueFrom) query = query.gte("revised_ex_factory_date", filters.dueFrom);
  if (filters.dueTo) query = query.lte("revised_ex_factory_date", filters.dueTo);

  if (filters.ctype) query = applyConstructionTypeFilter(query, filters.ctype);

  if (filters.search) {
    const term = `%${filters.search}%`;
    query = query.or(
      [
        "otn_no",
        "item_no",
        "sales_order_no",
        "customer_no",
        "merchant_name",
        "order_wise_merchant",
        "customer_po_no",
        "quality",
        "design",
        "size",
        "follow_up_person",
        "raw_current_status",
      ]
        .map((field) => `${field}.ilike.${term}`)
        .join(","),
    );
  }

  return query;
}

/** RLS already scopes which rows come back (admin/production/shipping/sales/merchant) —
 * this just applies the UI's own filters on top of whatever set that already is, with
 * real pagination (see OrderListResult.totalCount) rather than a single growing cap. */
export async function listOrders(supabase: SupabaseClient, filters: OrderFilters = {}): Promise<OrderListResult> {
  // filters.sortBy is a plain string round-tripped through a URL, not something the
  // type system can actually guarantee is one of SORTABLE_COLUMNS's keys — falls back
  // to the default rather than asking PostgREST to sort by an undefined/arbitrary
  // column if someone hand-crafts an invalid ?sortBy=.
  const isValidSort = Boolean(filters.sortBy && filters.sortBy in SORTABLE_COLUMNS);
  const sortColumn = isValidSort ? SORTABLE_COLUMNS[filters.sortBy as SortableColumn] : "updated_at";
  const ascending = isValidSort ? filters.sortDir !== "desc" : false; // default: updated_at desc
  let query = applyOrderFilters(supabase, filters).order(sortColumn, { ascending, nullsFirst: false });

  if (filters.page || filters.pageSize) {
    const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE;
    const page = Math.max(1, filters.page ?? 1);
    const from = (page - 1) * pageSize;
    query = query.range(from, from + pageSize - 1);
  } else {
    query = query.limit(filters.limit ?? 500);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { rows: data ?? [], totalCount: count ?? 0 };
}

export interface OrderFacets {
  customerNo: string[];
  merchantName: string[];
  orderWiseMerchant: string[];
  followUpPerson: string[];
  customerPoNo: string[];
  quality: string[];
  design: string[];
  size: string[];
  productionOrderStatus: string[];
  priority: string[];
}

/** Sorts a facet's distinct values the same way this page always has (locale-aware,
 * numeric strings ordered numerically) — the actual dedup now happens in Postgres (see
 * below), this is just presentation. */
function sortFacetValues(values: string[] | null | undefined): string[] {
  return [...(values ?? [])].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

/** Distinct real values for every multi-select filter above, so the Orders page can
 * offer real options instead of a free-text guess — the same role the old tool's
 * `/api/facets` endpoint played. Computed by `orders_list_facets()` (see
 * db/orders/018_perf_facets_and_stats_rpcs.sql) — a single round trip, Postgres does the
 * dedup itself, rather than this function paging through every real customer order in
 * JS a page at a time (~14 sequential round trips at today's ~13.6k-row scale; confirmed
 * live via EXPLAIN ANALYZE this used to be the biggest single reason /orders felt slow).
 * That SQL function is SECURITY INVOKER (the default), so the same `orders_select` RLS
 * policy still scopes the rows this aggregates over — a salesperson/merchant-scoped
 * caller still only ever sees facet values drawn from orders they could already see. */
/** Shape of `orders_list_facets()`'s single row — `supabase` here is deliberately a
 * plain, un-generic'd SupabaseClient (see this file's header comment), so `.rpc()`
 * can't infer this from the Database type the way a `SupabaseClient<Database>` caller
 * would; cast explicitly instead, same as every other query in this file does for its
 * own return shape (e.g. `as DashboardStatsRow[]` before this refactor). */
interface OrdersListFacetsRow {
  customer_no: string[] | null;
  merchant_name: string[] | null;
  order_wise_merchant: string[] | null;
  follow_up_person: string[] | null;
  customer_po_no: string[] | null;
  quality: string[] | null;
  design: string[] | null;
  size: string[] | null;
  production_order_status: string[] | null;
  priority: string[] | null;
}

export async function listOrderFacets(supabase: SupabaseClient): Promise<OrderFacets> {
  const { data, error } = await supabase.rpc("orders_list_facets").single();
  if (error) throw error;
  const row = data as OrdersListFacetsRow | null;
  return {
    customerNo: sortFacetValues(row?.customer_no),
    merchantName: sortFacetValues(row?.merchant_name),
    orderWiseMerchant: sortFacetValues(row?.order_wise_merchant),
    followUpPerson: sortFacetValues(row?.follow_up_person),
    customerPoNo: sortFacetValues(row?.customer_po_no),
    quality: sortFacetValues(row?.quality),
    design: sortFacetValues(row?.design),
    size: sortFacetValues(row?.size),
    productionOrderStatus: sortFacetValues(row?.production_order_status),
    priority: sortFacetValues(row?.priority),
  };
}

export interface DashboardStats {
  /** Rug lines in view — one row per item, the level stage-tracking actually happens
   * at (see distinctSalesOrders' own doc for why that's not the same as "orders"). */
  total: number;
  /** One Sales Order can (and very often does) span several rug lines — confirmed live
   * 2026-09-03: 14,214 rows then resolved to only 3,757 distinct Sales Order Nos, so a
   * single "Orders in view" number was quietly answering two different questions
   * depending on who read it. */
  distinctSalesOrders: number;
  delayedCount: number;
  /** stage_id -> count, for the "by stage" tiles. */
  countsByStage: Record<string, number>;
}

/** Dashboard's four stat tiles + per-stage breakdown, computed by
 * `orders_dashboard_stats()` (see db/orders/018_perf_facets_and_stats_rpcs.sql) — one
 * round trip, aggregated in Postgres — rather than this function pulling every real
 * customer order's id/stage/dates into Node to filter/reduce/Set-dedupe by hand.
 * Confirmed live via EXPLAIN ANALYZE: the old approach paged through ~13.6k rows in
 * sequential 1000-row round trips (PostgREST's per-request cap) on every single
 * Dashboard load — the single biggest reason that page felt slow. That SQL function is
 * SECURITY INVOKER (the default), so `orders_select`'s RLS policy still scopes what it
 * aggregates over, same as every other query in this app.
 *
 * delayed_count mirrors lib/tat.ts's onTimeStatus() for the specific case this page has
 * always used it in (stageStandardDays always null here — see this page's own comment,
 * unchanged by this refactor) — see that SQL function's comment for the exact mapping;
 * if onTimeStatus() itself changes, that SQL must be updated to match. */
/** Shape of `orders_dashboard_stats()`'s single row — see OrdersListFacetsRow's comment
 * above for why this is cast explicitly rather than inferred. */
interface OrdersDashboardStatsRow {
  total: number;
  distinct_sales_orders: number;
  delayed_count: number;
  counts_by_stage: Record<string, number> | null;
}

export async function getDashboardStats(supabase: SupabaseClient): Promise<DashboardStats> {
  const { data, error } = await supabase.rpc("orders_dashboard_stats").single();
  if (error) throw error;
  const row = data as OrdersDashboardStatsRow | null;
  return {
    total: Number(row?.total ?? 0),
    distinctSalesOrders: Number(row?.distinct_sales_orders ?? 0),
    delayedCount: Number(row?.delayed_count ?? 0),
    countsByStage: row?.counts_by_stage ?? {},
  };
}

export async function getOrder(supabase: SupabaseClient, orderId: string): Promise<OrderRow | null> {
  const { data, error } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getOrderStageEvents(
  supabase: SupabaseClient,
  orderId: string,
): Promise<StageEventRow[]> {
  const { data, error } = await supabase
    .from("order_stage_events")
    .select("*")
    .eq("order_id", orderId)
    .order("entered_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getShippingDetail(
  supabase: SupabaseClient,
  orderId: string,
): Promise<ShippingDetailRow | null> {
  const { data, error } = await supabase.from("shipping_details").select("*").eq("order_id", orderId).maybeSingle();
  if (error) throw error;
  return data;
}

/** Name -> email lookup for the Orders table's Follow Up Person column (hover/click to
 * copy — see db/orders/014_follow_up_person_directory.sql). Display/copy convenience
 * only, NOT the automated delay-alert routing table (that's a separate, still-unbuilt
 * thing — see ERP_AND_EXTERNAL_REQUESTS.md request #5). A name with no entry here just
 * means no confirmed email was found in the company directory — never guessed. */
export async function listFollowUpPersonEmails(supabase: SupabaseClient): Promise<Record<string, string>> {
  const { data, error } = await supabase.from("follow_up_person_directory").select("name, email");
  if (error) throw error;
  const result: Record<string, string> = {};
  for (const row of data ?? []) {
    if (row.email) result[row.name] = row.email;
  }
  return result;
}
