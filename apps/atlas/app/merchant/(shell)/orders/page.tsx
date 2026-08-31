import { getServerMerchantSupabaseClient } from "@/lib/merchant/supabaseClient.server";
import { listOrders, listStages } from "@/lib/queries/orders";
import { MerchantOrdersTable } from "@/components/merchant/MerchantOrdersTable";

export default async function MerchantOrdersPage() {
  const supabase = await getServerMerchantSupabaseClient();
  const [orders, stages] = await Promise.all([listOrders(supabase, { limit: 500 }), listStages(supabase)]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Your orders</h1>
        <p className="text-sm text-muted">{orders.length} order{orders.length === 1 ? "" : "s"}</p>
      </div>
      <MerchantOrdersTable rows={orders} stages={stages} />
    </div>
  );
}
