"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Table } from "@jaipur-rugs/ui-kit";
import { StageChip, OnTimeBadge } from "./StageChip";
import { onTimeStatus } from "@/lib/tat";
import { stageStandard } from "@/lib/stageTat";
import type { OrderRow, StageRow, SortableColumn } from "@/lib/queries/orders";

// Client component (not the plain server component this used to be) — needed for the
// row-selection + copy-as-Excel feature (real client state), and for building sort
// links locally off the current URL (useSearchParams) rather than needing a function
// prop passed across the server/client boundary, which Next.js doesn't allow.

/** Builds a link that changes only `sortBy`/`sortDir` (or `page`, for pagination),
 * preserving every other current query param — same logic the page used to do
 * server-side, just running client-side now since this whole table is a client
 * component. */
function useLinkBuilder() {
  const searchParams = useSearchParams();
  return (overrides: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [key, values] of searchParams.entries()) {
      if (key in overrides) continue;
      p.append(key, values);
    }
    // URLSearchParams.entries() already gives every repeated key once per value, but
    // the loop above re-appends per iteration correctly since .entries() yields each
    // key=value pair, including repeats, individually.
    for (const [key, value] of Object.entries(overrides)) {
      if (value !== undefined) p.set(key, value);
    }
    return `/orders?${p.toString()}`;
  };
}

interface SortableHeaderProps {
  column: SortableColumn;
  label: string;
  currentSort?: string;
  currentDir: "asc" | "desc";
  buildLink: (overrides: Record<string, string | undefined>) => string;
}

/** Clicking a sortable header sorts descending first (matches how everyone actually
 * wants to see e.g. pending days or OTN — biggest/most-recent first), clicking again
 * flips to ascending; an inactive column always starts from descending. Plain GET links,
 * not client state — the sort has to re-query the full server-side filtered/paginated
 * set, not just re-order whatever page happens to be loaded, so this deliberately
 * doesn't use Table's own allowsSorting/sortDescriptor (built for re-sorting an
 * already-loaded in-memory list client-side). */
function SortableLabel({ column, label, currentSort, currentDir, buildLink }: SortableHeaderProps) {
  const isActive = currentSort === column;
  const nextDir = isActive && currentDir === "desc" ? "asc" : "desc";
  return (
    <Link href={buildLink({ sortBy: column, sortDir: nextDir, page: undefined })} className="flex items-center gap-1 hover:text-foreground">
      {label}
      <span className="text-[10px]">{isActive ? (currentDir === "desc" ? "▼" : "▲") : "⇅"}</span>
    </Link>
  );
}

/** Columns included when copying selected rows — a plain-text, tab-separated table
 * (paste straight into Excel/Outlook/email) — the exact real workflow already happening
 * by hand today (see the GACHOT/Artemest dispatch-email screenshot this was built from):
 * someone manually re-typing a rug table into an email every time. Matches the old
 * tool's own "Copy for NAV (Excel row)" precedent, generalized from one order to
 * whichever rows are selected, and widened to the fuller field set real dispatch emails
 * actually carry (GR/BR color, shape, serial no, std cubage) rather than just NAV's own
 * narrower payload shape. */
function buildClipboardRows(selected: OrderRow[], stageById: Map<string, StageRow>): string {
  const headers = [
    "OTN No_", "Item No_", "Sales Order No_", "Customer No_", "Quality", "Design",
    "GR Color Name", "BR Color Name", "Shape", "Size", "Serial No_", "Std Cubage",
    "Current Status", "Stage", "Days in Stage", "Rev Ex-Factory",
  ];
  const lines = [headers.join("\t")];
  for (const o of selected) {
    const stage = o.stage_id ? stageById.get(o.stage_id) : undefined;
    lines.push(
      [
        o.otn_no, o.item_no, o.sales_order_no, o.customer_no, o.quality, o.design,
        o.gr_color_name, o.br_color_name, o.shape, o.size, o.serial_no, o.std_cubage,
        o.raw_current_status, stage?.display_name ?? "", o.current_status_pending_days,
        o.revised_ex_factory_date,
      ]
        .map((v) => (v === null || v === undefined ? "" : String(v)))
        .join("\t"),
    );
  }
  return lines.join("\n");
}

// Real Table component (Hero UI, via @jaipur-rugs/ui-kit), not a hand-rolled <table> —
// its Table.ScrollContainer + sticky Table.Header is what actually freezes the column
// headers correctly while the body scrolls, fixed 2026-09-05 after a manual
// position:sticky-with-a-guessed-offset attempt turned out fragile.
export function OrdersTable({ rows, stages }: { rows: OrderRow[]; stages: StageRow[] }) {
  const stageById = new Map(stages.map((s) => [s.id, s]));
  const buildLink = useLinkBuilder();
  const searchParams = useSearchParams();
  const currentSort = searchParams.get("sortBy") ?? undefined;
  const currentDir = (searchParams.get("sortDir") as "asc" | "desc" | null) ?? "desc";

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
    setCopyStatus(null);
  }

  async function copySelected() {
    const selected = rows.filter((o) => selectedIds.has(o.id));
    if (!selected.length) return;
    try {
      await navigator.clipboard.writeText(buildClipboardRows(selected, stageById));
      setCopyStatus(`Copied ${selected.length} row${selected.length === 1 ? "" : "s"} — paste into Excel/email.`);
    } catch {
      setCopyStatus("Couldn't copy — your browser may need clipboard permission.");
    }
    setTimeout(() => setCopyStatus(null), 3000);
  }

  if (!rows.length) {
    return <p className="rounded-xl border-2 border-border p-8 text-center text-sm text-muted">No orders match these filters.</p>;
  }

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex shrink-0 items-center gap-3">
        {selectMode ? (
          <>
            <span className="text-sm text-muted">{selectedIds.size} selected</span>
            <button
              type="button"
              onClick={copySelected}
              disabled={!selectedIds.size}
              className="rounded-lg border-2 border-border px-3 py-1.5 text-sm hover:bg-surface-secondary disabled:opacity-40"
            >
              Copy selected
            </button>
            <button type="button" onClick={exitSelectMode} className="text-sm text-accent hover:underline">
              Cancel
            </button>
            {copyStatus ? <span className="text-sm text-muted">{copyStatus}</span> : null}
          </>
        ) : (
          <button
            type="button"
            onClick={() => setSelectMode(true)}
            className="rounded-lg border-2 border-border px-3 py-1.5 text-sm hover:bg-surface-secondary"
          >
            Select
          </button>
        )}
      </div>

      <Table className="h-full min-h-0 flex-1">
        <Table.ScrollContainer className="h-full overflow-y-auto rounded-xl border-2 border-border">
          <Table.Content aria-label="Orders" className="min-w-[900px]">
            <Table.Header className="sticky top-0 z-10 bg-surface-secondary text-xs uppercase text-muted">
              {selectMode ? <Table.Column id="select">✓</Table.Column> : null}
              <Table.Column isRowHeader id="otn">
                <SortableLabel column="otn" label="OTN / Item" currentSort={currentSort} currentDir={currentDir} buildLink={buildLink} />
              </Table.Column>
              <Table.Column id="merchant">
                <SortableLabel column="merchant" label="Merchant" currentSort={currentSort} currentDir={currentDir} buildLink={buildLink} />
              </Table.Column>
              <Table.Column id="design">
                <SortableLabel column="design" label="Design / Quality" currentSort={currentSort} currentDir={currentDir} buildLink={buildLink} />
              </Table.Column>
              {/* Stage is deliberately plain text, not sortable — a real attempt to sort
                  by the joined stage's display_order didn't actually work in practice
                  (confirmed live 2026-09-05), and rather than leave a sort control that
                  silently does nothing, it's removed until that's fixed for real. */}
              <Table.Column id="stage">Stage</Table.Column>
              <Table.Column id="pendingDays">
                <SortableLabel column="pendingDays" label="Days in Stage" currentSort={currentSort} currentDir={currentDir} buildLink={buildLink} />
              </Table.Column>
              <Table.Column id="stageStandard">Stage Standard (TAT)</Table.Column>
              <Table.Column id="revisedExFactory">
                <SortableLabel column="revisedExFactory" label="Rev. Ex-Factory" currentSort={currentSort} currentDir={currentDir} buildLink={buildLink} />
              </Table.Column>
              <Table.Column id="onTime">On Time</Table.Column>
            </Table.Header>
            <Table.Body>
              {rows.map((order) => {
                const stage = order.stage_id ? stageById.get(order.stage_id) : undefined;
                const status = onTimeStatus(order.promised_delivery_date, order.revised_ex_factory_date, stage?.is_terminal ?? false);
                const standard = stageStandard({
                  rawCurrentStatus: order.raw_current_status,
                  quality: order.quality,
                  size: order.size,
                  stdCubage: order.std_cubage,
                  orderPriority: order.order_priority,
                  onHold: order.on_hold,
                  currentStatusPendingDays: order.current_status_pending_days,
                });
                return (
                  <Table.Row key={order.id} id={order.id}>
                    {selectMode ? (
                      <Table.Cell>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(order.id)}
                          onChange={() => toggleRow(order.id)}
                          aria-label={`Select ${order.otn_no}`}
                        />
                      </Table.Cell>
                    ) : null}
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
                    <Table.Cell>
                      {standard.status === "on_hold" ? (
                        <span className="text-muted">On hold</span>
                      ) : standard.status === "no_standard" ? (
                        <span className="text-muted">—</span>
                      ) : (
                        <span className={standard.status === "breached" ? "text-danger" : "text-foreground"}>
                          {standard.standardDays}d standard
                          {standard.status === "breached" ? ` (+${standard.overBy}d over)` : ""}
                        </span>
                      )}
                    </Table.Cell>
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
    </div>
  );
}
