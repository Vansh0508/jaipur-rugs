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
}

/** RLS already scopes which rows come back (admin/production/shipping/sales/merchant) —
 * this just applies the UI's own filters on top of whatever set that already is. */
export async function listOrders(supabase: SupabaseClient, filters: OrderFilters = {}): Promise<OrderRow[]> {
  let query = supabase.from("orders").select("*").order("updated_at", { ascending: false }).limit(filters.limit ?? 500);

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
}

/** Every order the caller can see, but only the 4 columns the dashboard's aggregate
 * stats actually need — and paginated via .range(), not a single limit(). Confirmed
 * live 2026-09-02: PostgREST caps any single request at 1000 rows no matter what
 * limit() asks for, so the dashboard's earlier listOrders({ limit: 2000 }) was silently
 * truncated to the 1000 most-recently-updated orders and showing that as the total
 * against a real 14,214-row table — wrong, not just incomplete. Ordered by `id` (stable
 * primary key), not `updated_at`, so a page boundary can't skip/duplicate a row that
 * happens to get touched by the ERP sync between page fetches.
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
      .select("id, stage_id, promised_delivery_date, revised_ex_factory_date")
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
