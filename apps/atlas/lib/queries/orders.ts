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

export interface OrderFilters {
  stageId?: string;
  customerNo?: string;
  search?: string; // matches otn_no/item_no/design/merchant_name
  limit?: number;
  /** Include the 5 internal stock/inventory customer codes (see STOCK_CUSTOMER_CODES).
   * Defaults to false — they're excluded from every normal view, same as the old tool. */
  includeStock?: boolean;
}

/** RLS already scopes which rows come back (admin/production/shipping/sales/merchant) —
 * this just applies the UI's own filters on top of whatever set that already is. */
export async function listOrders(supabase: SupabaseClient, filters: OrderFilters = {}): Promise<OrderRow[]> {
  let query = supabase.from("orders").select("*").order("updated_at", { ascending: false }).limit(filters.limit ?? 500);

  if (!filters.includeStock) query = query.not("customer_no", "in", `(${STOCK_CUSTOMER_CODES.join(",")})`);
  if (filters.stageId) query = query.eq("stage_id", filters.stageId);
  if (filters.customerNo) query = query.eq("customer_no", filters.customerNo);
  if (filters.search) {
    const term = `%${filters.search}%`;
    query = query.or(
      `otn_no.ilike.${term},item_no.ilike.${term},design.ilike.${term},merchant_name.ilike.${term}`,
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
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
