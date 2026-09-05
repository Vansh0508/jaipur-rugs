import Link from "next/link";
import { StageChip, OnTimeBadge } from "./StageChip";
import { onTimeStatus } from "@/lib/tat";
import type { OrderRow, StageRow, SortableColumn } from "@/lib/queries/orders";

interface SortableHeaderProps {
  column: SortableColumn;
  label: string;
  currentSort?: SortableColumn;
  currentDir: "asc" | "desc";
  sortLinkFor: (column: SortableColumn, dir: "asc" | "desc") => string;
}

/** Clicking a sortable header sorts descending first (matches how everyone actually
 * wants to see e.g. pending days or OTN — biggest/most-recent first), clicking again
 * flips to ascending; an inactive column always starts from descending. Plain GET links,
 * not client state — consistent with the rest of this page. */
function SortableHeader({ column, label, currentSort, currentDir, sortLinkFor }: SortableHeaderProps) {
  const isActive = currentSort === column;
  const nextDir = isActive && currentDir === "desc" ? "asc" : "desc";
  return (
    <th className="px-4 py-3 font-medium">
      <Link href={sortLinkFor(column, nextDir)} className="flex items-center gap-1 hover:text-foreground">
        {label}
        <span className="text-[10px]">{isActive ? (currentDir === "desc" ? "▼" : "▲") : "⇅"}</span>
      </Link>
    </th>
  );
}

// Plain semantic <table>, same idiom as apps/hub's TeamTable — a scannable list with a
// per-row link is simple enough not to need react-aria's collection machinery.
export function OrdersTable({
  rows,
  stages,
  currentSort,
  currentDir = "desc",
  sortLinkFor,
}: {
  rows: OrderRow[];
  stages: StageRow[];
  currentSort?: SortableColumn;
  currentDir?: "asc" | "desc";
  sortLinkFor: (column: SortableColumn, dir: "asc" | "desc") => string;
}) {
  const stageById = new Map(stages.map((s) => [s.id, s]));

  if (!rows.length) {
    return <p className="rounded-xl border-2 border-border p-8 text-center text-sm text-muted">No orders match these filters.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border-2 border-border">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b-2 border-border text-xs uppercase text-muted">
            <SortableHeader column="otn" label="OTN / Item" currentSort={currentSort} currentDir={currentDir} sortLinkFor={sortLinkFor} />
            <SortableHeader column="merchant" label="Merchant" currentSort={currentSort} currentDir={currentDir} sortLinkFor={sortLinkFor} />
            <SortableHeader column="design" label="Design / Quality" currentSort={currentSort} currentDir={currentDir} sortLinkFor={sortLinkFor} />
            <SortableHeader column="stage" label="Stage" currentSort={currentSort} currentDir={currentDir} sortLinkFor={sortLinkFor} />
            <SortableHeader column="pendingDays" label="Days in Stage" currentSort={currentSort} currentDir={currentDir} sortLinkFor={sortLinkFor} />
            <SortableHeader column="revisedExFactory" label="Rev. Ex-Factory" currentSort={currentSort} currentDir={currentDir} sortLinkFor={sortLinkFor} />
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
                {/* revised_ex_factory_date, not promised_delivery_date — confirmed
                    2026-09-05 (via the pre-Atlas tool's own investigation, same ERP
                    feed) that Promised Delivery Date is essentially always blank in
                    real data; this is the actual delay/expectancy signal, and what
                    onTimeStatus below already falls back to. */}
                <td className="px-4 py-3">{order.revised_ex_factory_date ?? "—"}</td>
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
