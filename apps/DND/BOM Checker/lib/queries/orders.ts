import type { SupabaseClient } from "@supabase/supabase-js";
import type { Tables } from "@jaipur-rugs/supabase-client";

export type OrderRow = Tables<"orders">;
export type StageRow = Tables<"stages">;
export type StageEventRow = Tables<"order_stage_events">;
export type ShippingDetailRow = Tables<"shipping_details">;

export const STOCK_CUSTOMER_CODES = ["0277", "0177", "0877", "0322", "0108"];

let cachedStages: { data: StageRow[]; expiresAt: number } | null = null;

export async function listStages(supabase: SupabaseClient, forceRefresh = false): Promise<StageRow[]> {
  if (!forceRefresh && cachedStages && Date.now() < cachedStages.expiresAt) {
    return cachedStages.data;
  }
  const { data, error } = await supabase.from("stages").select("*").order("display_order", { ascending: true });
  if (error) throw error;
  const stages = data ?? [];
  cachedStages = { data: stages, expiresAt: Date.now() + 10 * 60 * 1000 };
  return stages;
}

export const PAGE_SIZE_OPTIONS = [20, 50, 100, 500] as const;
export const DEFAULT_PAGE_SIZE = 20;

export type ConstructionType = "knotted" | "tufted" | "handloom" | "other" | "swatch";
export type AgingBucket = "0-7" | "8-15" | "16-30" | "30+";
export type DelayStatusFilter = "late" | "soon" | "late_or_soon";
export type YesNo = "yes" | "no";

export interface OrderFilters {
  search?: string;
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
  aging?: AgingBucket;
  onHold?: YesNo;
  quickShip?: YesNo;
  delayStatus?: DelayStatusFilter;
  terminalStageIds?: string[];
  dueFrom?: string;
  dueTo?: string;
  ctype?: ConstructionType;
  page?: number;
  pageSize?: number;
  limit?: number;
  sortBy?: SortableColumn;
  sortDir?: "asc" | "desc";
  includeStock?: boolean;
}

export interface OrderListResult {
  rows: OrderRow[];
  totalCount: number;
}

const SWATCH_MAX_SQFT = 4;

export const SORTABLE_COLUMNS = {
  itemNo: "item_no",
  otn: "otn_no",
  merchant: "merchant_name",
  customerPo: "customer_po_no",
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
  matchingCode: "matching_code",
  grColor: "gr_color_name",
  brColor: "br_color_name",
  shape: "shape",
} as const;
export type SortableColumn = keyof typeof SORTABLE_COLUMNS;

export function toList(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  return (Array.isArray(value) ? value : [value]).map((v) => v.trim()).filter(Boolean);
}

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
    else query = query.lte("revised_ex_factory_date", in7Days);
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

export async function listOrders(supabase: SupabaseClient, filters: OrderFilters = {}): Promise<OrderListResult> {
  const isValidSort = Boolean(filters.sortBy && filters.sortBy in SORTABLE_COLUMNS);
  const sortColumn = isValidSort ? SORTABLE_COLUMNS[filters.sortBy as SortableColumn] : "sales_order_date";
  const ascending = isValidSort ? filters.sortDir !== "desc" : false;
  let query = applyOrderFilters(supabase, filters)
    .order(sortColumn, { ascending, nullsFirst: false })
    .order("created_at", { ascending: false, nullsFirst: false });

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

let cachedFacets: { data: OrderFacets; expiresAt: number } | null = null;

export async function listOrderFacets(supabase: SupabaseClient, forceRefresh = false): Promise<OrderFacets> {
  if (!forceRefresh && cachedFacets && Date.now() < cachedFacets.expiresAt) {
    return cachedFacets.data;
  }

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
  cachedFacets = { data: result, expiresAt: Date.now() + 5 * 60 * 1000 };
  return result;
}

export interface DashboardStatsRow {
  id: string;
  stage_id: string | null;
  promised_delivery_date: string | null;
  revised_ex_factory_date: string | null;
  sales_order_no: string | null;
}

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

export async function listFollowUpPersonEmails(supabase: SupabaseClient): Promise<Record<string, string>> {
  const { data, error } = await supabase.from("follow_up_person_directory").select("name, email");
  if (error) throw error;
  const result: Record<string, string> = {};
  for (const row of data ?? []) {
    if (row.email) result[row.name] = row.email;
  }
  return result;
}
