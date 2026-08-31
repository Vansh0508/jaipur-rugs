import type { SupabaseClient } from "@supabase/supabase-js";

// Plain SupabaseClient, not SupabaseClient<Database> — see lib/queries/orders.ts's comment.

export interface MerchantWithCodes {
  id: string;
  displayName: string;
  primaryContactEmail: string;
  linked: boolean;
  customerNos: string[];
}

/** Admin-only in practice — RLS's merchants_select/merchant_customer_codes_select only
 * return every row to an orders.read.all holder; anyone else gets nothing back here. */
export async function listMerchantsWithCodes(supabase: SupabaseClient): Promise<MerchantWithCodes[]> {
  const { data, error } = await supabase
    .from("merchants")
    .select("id, display_name, primary_contact_email, clerk_user_id, merchant_customer_codes(customer_no)")
    .order("display_name", { ascending: true });
  if (error) throw error;

  return (data ?? []).map((m) => ({
    id: m.id,
    displayName: m.display_name,
    primaryContactEmail: m.primary_contact_email,
    linked: Boolean(m.clerk_user_id),
    customerNos: (m.merchant_customer_codes ?? []).map((c: { customer_no: string }) => c.customer_no),
  }));
}
