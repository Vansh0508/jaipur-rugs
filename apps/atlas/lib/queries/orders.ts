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

// Page sizes offered on the Orders list — same options the old tool offered
// (50/100/250/500/1000, default 100), see PAGE_SIZE_OPTIONS below.
export const PAGE_SIZE_OPTIONS = [50, 100, 250, 500, 1000] as const;
export const DEFAULT_PAGE_SIZE = 100;

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

const SWATCH_MAX_SQFT = 4;

/** Every column the Orders table lets someone sort by — a fixed whitelist mapping a
 * plain user-facing key to the real DB column, so a request can never sort by an
 * arbitrary column. Stage and On-Time aren't here: a real attempt at sorting Stage by
 * the joined stages.display_order didn't actually work in practice (confirmed live
 * 2026-09-05) and was removed rather than left silently broken — worth revisiting for
 * real later. On-Time is computed client-side, not stored anywhere to sort by. */
export const SORTABLE_COLUMNS = {
  otn: "otn_no",
  merchant: "merchant_name",
  design: "design",
  quality: "quality",
  pendingDays: "current_status_pending_days",
  revisedExFactory: "revised_ex_factory_date",
} as const;
export type SortableColumn = keyof typeof SORTABLE_COLUMNS;

/** Normalizes a filter value that might arrive as a single string or an array (a plain
 * <select multiple>'s query params, or a hand-built URL) into a clean string array. */
function toList(value: string | string[] | undefined): string[] {
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

const FACET_COLUMNS = [
  ["customer_no", "customerNo"],
  ["merchant_name", "merchantName"],
  ["order_wise_merchant", "orderWiseMerchant"],
  ["follow_up_person", "followUpPerson"],
  ["customer_po_no", "customerPoNo"],
  ["quality", "quality"],
  ["design", "design"],
  ["size", "size"],
  ["production_order_status", "productionOrderStatus"],
  ["order_priority", "priority"],
] as const;

/** Distinct real values for every multi-select filter above, so the Orders page can
 * offer real options instead of a free-text guess — the same role the old tool's
 * `/api/facets` endpoint played. One paginated pass over every real customer order
 * (stock excluded), pulling only these 10 narrow columns, deduping in JS — same pattern
 * as listAllOrdersForStats, and for the same reason: PostgREST caps a single request at
 * 1000 rows, and there's no cheap SQL-side "distinct across many columns at once"
 * available without a bespoke RPC. Fine at today's scale (~10k real orders / a dozen
 * requests); revisit with a real SQL aggregate if that grows an order of magnitude. */
export async function listOrderFacets(supabase: SupabaseClient): Promise<OrderFacets> {
  const columns = FACET_COLUMNS.map(([col]) => col).join(", ");
  const sets = Object.fromEntries(FACET_COLUMNS.map(([, key]) => [key, new Set<string>()])) as Record<
    keyof OrderFacets,
    Set<string>
  >;

  const PAGE_SIZE = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("orders")
      .select(columns)
      .not("customer_no", "in", `(${STOCK_CUSTOMER_CODES.join(",")})`)
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    for (const row of (data ?? []) as unknown as Record<string, unknown>[]) {
      for (const [col, key] of FACET_COLUMNS) {
        const value = row[col];
        if (value !== null && value !== undefined && String(value).trim().length) {
          sets[key].add(String(value).trim());
        }
      }
    }
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  const result = {} as OrderFacets;
  for (const [, key] of FACET_COLUMNS) {
    result[key as keyof OrderFacets] = [...sets[key]].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }
  return result;
}

export interface DashboardStatsRow {
  id: string;
  stage_id: string | null;
  promised_delivery_date: string | null;
  revised_ex_factory_date: string | null;
  /** One Sales Order can (and very often does) span several rows here — one per rug/
   * item line, since that's the level stage-tracking actually happens at. Needed so the
   * dashboard can report "how many real orders" separately from "how many rug lines"
   * instead of conflating the two under one "Orders in view" number — confirmed live
   * 2026-09-03: 14,214 rows resolved to only 3,757 distinct Sales Order Nos. */
  sales_order_no: string | null;
}

/** Every real customer order the caller can see (stock/inventory codes excluded, see
 * STOCK_CUSTOMER_CODES), but only the columns the dashboard's aggregate stats actually
 * need — and paginated via .range(), not a single limit(). Confirmed live 2026-09-02:
 * PostgREST caps any single request at 1000 rows no matter what limit() asks for, so
 * the dashboard's earlier listOrders({ limit: 2000 }) was silently truncated to the
 * 1000 most-recently-updated orders and showing that as the total against a real
 * 14,214-row table — wrong, not just incomplete. Ordered by `id` (stable primary key),
 * not `updated_at`, so a page boundary can't skip/duplicate a row that happens to get
 * touched by the ERP sync between page fetches.
 *
 * Fine at today's scale (a dozen or so requests per dashboard load). If order volume
 * grows another order of magnitude, this should become a real server-side aggregate
 * (a SQL view/RPC doing count/group by) instead of pulling every row to count in JS. */
export async function listAllOrdersForStats(supabase: SupabaseClient): Promise<DashboardStatsRow[]> {
  const PAGE_SIZE = 1000;
  const rows: DashboardStatsRow[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("orders")
      .select("id, stage_id, promised_delivery_date, revised_ex_factory_date, sales_order_no")
      .not("customer_no", "in", `(${STOCK_CUSTOMER_CODES.join(",")})`)
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as DashboardStatsRow[]));
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return rows;
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
