import Link from "next/link";
import { Table } from "@jaipur-rugs/ui-kit";
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
 * not client state — the sort has to re-query the full server-side filtered/paginated
 * set, not just re-order whatever page happens to be loaded, so this deliberately
 * doesn't use Table's own allowsSorting/sortDescriptor (built for re-sorting an
 * already-loaded in-memory list client-side). */
function SortableLabel({ column, label, currentSort, currentDir, sortLinkFor }: SortableHeaderProps) {
  const isActive = currentSort === column;
  const nextDir = isActive && currentDir === "desc" ? "asc" : "desc";
  return (
    <Link href={sortLinkFor(column, nextDir)} className="flex items-center gap-1 hover:text-foreground">
      {label}
      <span className="text-[10px]">{isActive ? (currentDir === "desc" ? "▼" : "▲") : "⇅"}</span>
    </Link>
  );
}

// Real Table component (Hero UI, via @jaipur-rugs/ui-kit), not a hand-rolled <table> —
// its Table.ScrollContainer + sticky Table.Header is what actually freezes the column
// headers correctly while the body scrolls, fixed 2026-09-05 after a manual
// position:sticky-with-a-guessed-offset attempt turned out fragile (two independently
// sticky elements can't self-stack without knowing each other's height).
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
    <Table className="h-full">
      <Table.ScrollContainer className="h-full overflow-y-auto rounded-xl border-2 border-border">
        <Table.Content aria-label="Orders" className="min-w-[900px]">
          <Table.Header className="sticky top-0 z-10 bg-surface-secondary text-xs uppercase text-muted">
            <Table.Column isRowHeader id="otn">
              <SortableLabel column="otn" label="OTN / Item" currentSort={currentSort} currentDir={currentDir} sortLinkFor={sortLinkFor} />
            </Table.Column>
            <Table.Column id="merchant">
              <SortableLabel column="merchant" label="Merchant" currentSort={currentSort} currentDir={currentDir} sortLinkFor={sortLinkFor} />
            </Table.Column>
            <Table.Column id="design">
              <SortableLabel column="design" label="Design / Quality" currentSort={currentSort} currentDir={currentDir} sortLinkFor={sortLinkFor} />
            </Table.Column>
            <Table.Column id="stage">
              <SortableLabel column="stage" label="Stage" currentSort={currentSort} currentDir={currentDir} sortLinkFor={sortLinkFor} />
            </Table.Column>
            <Table.Column id="pendingDays">
              <SortableLabel column="pendingDays" label="Days in Stage" currentSort={currentSort} currentDir={currentDir} sortLinkFor={sortLinkFor} />
            </Table.Column>
            <Table.Column id="revisedExFactory">
              <SortableLabel column="revisedExFactory" label="Rev. Ex-Factory" currentSort={currentSort} currentDir={currentDir} sortLinkFor={sortLinkFor} />
            </Table.Column>
            <Table.Column id="onTime">On Time</Table.Column>
          </Table.Header>
          <Table.Body>
            {rows.map((order) => {
              const stage = order.stage_id ? stageById.get(order.stage_id) : undefined;
              const status = onTimeStatus(order.promised_delivery_date, order.revised_ex_factory_date, stage?.is_terminal ?? false);
              return (
                <Table.Row key={order.id} id={order.id}>
                  <Table.Cell>
                    <Link href={`/orders/${order.id}`} className="font-medium text-accent hover:underline">
                      {order.otn_no}
                    </Link>
                    <div className="text-xs text-muted">{order.item_no}</div>
                  </Table.Cell>
                  <Table.Cell>
                    <div>{order.merchant_name ?? "—"}</div>
                    <div className="text-xs text-muted">{order.customer_no ?? "—"}</div>
                  </Table.Cell>
                  <Table.Cell>
                    <div>{order.design ?? "—"}</div>
                    <div className="text-xs text-muted">{order.quality ?? "—"}</div>
                  </Table.Cell>
                  <Table.Cell>
                    <StageChip code={stage?.code ?? null} label={stage?.display_name ?? "Unresolved"} />
                  </Table.Cell>
                  <Table.Cell>{order.current_status_pending_days ?? "—"}</Table.Cell>
                  {/* revised_ex_factory_date, not promised_delivery_date — confirmed
                      2026-09-05 (via the pre-Atlas tool's own investigation, same ERP
                      feed) that Promised Delivery Date is essentially always blank in
                      real data; this is the actual delay/expectancy signal, and what
                      onTimeStatus above already falls back to. */}
                  <Table.Cell>{order.revised_ex_factory_date ?? "—"}</Table.Cell>
                  <Table.Cell>
                    <OnTimeBadge status={status} />
                  </Table.Cell>
                </Table.Row>
              );
            })}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
}
