import Link from "next/link";
import { StageChip, OnTimeBadge } from "./StageChip";
import { onTimeStatus } from "@/lib/tat";
import type { OrderRow, StageRow } from "@/lib/queries/orders";

// Plain semantic <table>, same idiom as apps/hub's TeamTable — a scannable list with a
// per-row link is simple enough not to need react-aria's collection machinery.
export function OrdersTable({ rows, stages }: { rows: OrderRow[]; stages: StageRow[] }) {
  const stageById = new Map(stages.map((s) => [s.id, s]));

  if (!rows.length) {
    return <p className="rounded-xl border-2 border-border p-8 text-center text-sm text-muted">No orders match these filters.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border-2 border-border">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b-2 border-border text-xs uppercase text-muted">
            <th className="px-4 py-3 font-medium">OTN / Item</th>
            <th className="px-4 py-3 font-medium">Merchant</th>
            <th className="px-4 py-3 font-medium">Design / Quality</th>
            <th className="px-4 py-3 font-medium">Stage</th>
            <th className="px-4 py-3 font-medium">Days in Stage</th>
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
                  <Link href={`/orders/${order.id}`} className="font-medium text-accent hover:underline">
                    {order.otn_no}
                  </Link>
                  <div className="text-xs text-muted">{order.item_no}</div>
                </td>
                <td className="px-4 py-3">
                  <div>{order.merchant_name ?? "—"}</div>
                  <div className="text-xs text-muted">{order.customer_no ?? "—"}</div>
                </td>
                <td className="px-4 py-3">
                  <div>{order.design ?? "—"}</div>
                  <div className="text-xs text-muted">{order.quality ?? "—"}</div>
                </td>
                <td className="px-4 py-3">
                  <StageChip code={stage?.code ?? null} label={stage?.display_name ?? "Unresolved"} />
                </td>
                <td className="px-4 py-3">{order.current_status_pending_days ?? "—"}</td>
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
