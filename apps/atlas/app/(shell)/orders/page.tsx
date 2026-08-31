import { getServerSupabaseClient } from "@/lib/supabaseClient.server";
import { listOrders, listStages } from "@/lib/queries/orders";
import { OrdersTable } from "@/components/OrdersTable";
import { ExportOrdersButton } from "@/components/ExportOrdersButton";
import { StageChip } from "@/components/StageChip";
import Link from "next/link";

// Plain GET-based filters (?stageId=&q=) rather than client-side state — a shareable
// URL for "show me Loom stage" is worth more here than avoiding a full-page navigation,
// and RLS is already doing the real, security-relevant filtering server-side regardless.
export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ stageId?: string; q?: string }>;
}) {
  const params = await searchParams;
  const supabase = await getServerSupabaseClient();
  const [orders, stages] = await Promise.all([
    listOrders(supabase, { stageId: params.stageId, search: params.q }),
    listStages(supabase),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Orders</h1>
          <p className="text-sm text-muted">{orders.length} shown{params.stageId || params.q ? " (filtered)" : ""}</p>
        </div>
        <ExportOrdersButton rows={orders} stages={stages} />
      </div>

      <form method="get" className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="Search OTN, item, design, merchant…"
          className="w-72 rounded-lg border-2 border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <select
          name="stageId"
          defaultValue={params.stageId ?? ""}
          className="rounded-lg border-2 border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-accent"
        >
          <option value="">All stages</option>
          {stages.map((stage) => (
            <option key={stage.id} value={stage.id}>
              {stage.display_name}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded-lg border-2 border-border px-3 py-2 text-sm hover:bg-surface-secondary">
          Filter
        </button>
        {params.stageId || params.q ? (
          <Link href="/orders" className="text-sm text-accent hover:underline">
            Clear
          </Link>
        ) : null}
      </form>

      {params.stageId ? (
        <div>
          {(() => {
            const stage = stages.find((s) => s.id === params.stageId);
            return stage ? <StageChip code={stage.code} label={`Filtered: ${stage.display_name}`} /> : null;
          })()}
        </div>
      ) : null}

      <OrdersTable rows={orders} stages={stages} />
    </div>
  );
}
