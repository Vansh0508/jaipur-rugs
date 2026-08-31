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
