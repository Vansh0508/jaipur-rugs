import type { SupabaseClient } from "@supabase/supabase-js";
import type { Tables } from "@jaipur-rugs/supabase-client";

export type DelayAlertRow = Tables<"order_delay_alerts"> & {
  orders: { otn_no: string; item_no: string } | null;
};

/** Every delay alert the caller can see (RLS scopes this to orders they can already see
 * — same rule as order_stage_events/shipping_details), newest first. `sent_at` is null
 * for every row today — see order_delay_alerts's own comment: composing and de-duping
 * is built; actually sending needs a real email service connected first. */
export async function listDelayAlerts(supabase: SupabaseClient, limit = 200): Promise<DelayAlertRow[]> {
  const { data, error } = await supabase
    .from("order_delay_alerts")
    .select("*, orders(otn_no, item_no)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as DelayAlertRow[];
}
