import Link from "next/link";
import { StageChip, OnTimeBadge } from "@/components/StageChip";
import { onTimeStatus } from "@/lib/tat";
import type { OrderRow, StageRow } from "@/lib/queries/orders";

// Separate from the staff OrdersTable on purpose (build prompt Section 1.1 — the
// merchant view should be the most restrained of all): fewer columns, nothing internal
// (no salesperson code, no raw ERP status text, no production-order numbers), and links
// into /merchant/orders/[id] rather than the staff detail route.
export function MerchantOrdersTable({ rows, stages }: { rows: OrderRow[]; stages: StageRow[] }) {
  const stageById = new Map(stages.map((s) => [s.id, s]));

  if (!rows.length) {
    return <p className="rounded-xl border-2 border-border p-8 text-center text-sm text-muted">No orders yet.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border-2 border-border">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b-2 border-border text-xs uppercase text-muted">
            <th className="px-4 py-3 font-medium">Order</th>
            <th className="px-4 py-3 font-medium">Design / Size</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Promised Delivery</th>
            <th className="px-4 py-3 font-medium">On Time</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((order) => {
            const stage = order.stage_id ? stageById.get(order.stage_id) : undefined;
            const status = onTimeStatus(order.promised_delivery_date, order.revised_ex_factory_date, stage?.is_terminal ?? false);
            return (
              <tr key={order.id} className="border-b border-border last:border-0 hover:bg-surface-secondary">
                <td className="px-4 py-3">
                  <Link href={`/merchant/orders/${order.id}`} className="font-medium text-accent hover:underline">
                    {order.otn_no}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  {order.design ?? "—"} · {order.size ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <StageChip code={stage?.code ?? null} label={stage?.display_name ?? "In progress"} />
                </td>
                <td className="px-4 py-3">{order.promised_delivery_date ?? "—"}</td>
                <td className="px-4 py-3">
                  <OnTimeBadge status={status} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
