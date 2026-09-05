"use client";

import { useMemo, useState } from "react";
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

type TatSortDir = "asc" | "desc" | null;

/** Stage Standard (TAT) is a computed value, not a real column — there's nothing in the
 * database to ask Postgres to sort by, so unlike every other sortable column here, this
 * one only re-orders whatever page of rows is already loaded (client-side), not the
 * full filtered/paginated set. Null (no standard exists for this status, or the order
 * is on hold) always sorts last regardless of direction, matching every other sort in
 * this app. */
function TatSortableLabel({ dir, onToggle }: { dir: TatSortDir; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} className="flex items-center gap-1 hover:text-foreground">
      Stage Standard (TAT)
      <span className="text-[10px]">{dir === "desc" ? "▼" : dir === "asc" ? "▲" : "⇅"}</span>
    </button>
  );
}

/** How many days over (positive) or under (negative) its stage standard this order is —
 * null if there's no standard to compare against at all (excluded from the sort). */
function tatSortValue(order: OrderRow): number | null {
  const standard = stageStandard({
    rawCurrentStatus: order.raw_current_status,
    quality: order.quality,
    size: order.size,
    stdCubage: order.std_cubage,
    orderPriority: order.order_priority,
    onHold: order.on_hold,
    currentStatusPendingDays: order.current_status_pending_days,
  });
  if (standard.standardDays === null) return null;
  return (order.current_status_pending_days ?? 0) - standard.standardDays;
}

/** navigator.clipboard.writeText needs a secure context (HTTPS, or localhost) — this
 * server is plain HTTP (confirmed live 2026-09-05: the copy button failed with
 * "Couldn't copy" for exactly this reason, same root cause as the earlier login-cookie
 * bug). Falls back to the classic hidden-textarea + execCommand("copy") approach, which
 * doesn't require a secure context — the same fallback the old tool itself used for
 * this exact reason. */
async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to the textarea approach below
    }
  }
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
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
    "GR Color Name", "BR Color Name", "Shape", "Size", "Construction", "Serial No_",
    "Std Cubage", "Current Status", "Stage", "Days in Stage", "Original Ex Factory",
    "Sales Order Date", "Rev Ex-Factory",
  ];
  const lines = [headers.join("\t")];
  for (const o of selected) {
    const stage = o.stage_id ? stageById.get(o.stage_id) : undefined;
    lines.push(
      [
        o.otn_no, o.item_no, o.sales_order_no, o.customer_no, o.quality, o.design,
        o.gr_color_name, o.br_color_name, o.shape, o.size, o.construction, o.serial_no,
        o.std_cubage, o.raw_current_status, stage?.display_name ?? "",
        o.current_status_pending_days, o.original_ex_factory_date, o.sales_order_date,
        o.revised_ex_factory_date,
      ]
        .map((v) => (v === null || v === undefined ? "" : String(v)))
        .join("\t"),
    );
  }
  return lines.join("\n");
}

// Real Table component (Hero UI, via @jaipur-rugs/ui-kit), not a hand-rolled <table> —
// its Table.ResizableContainer + sticky Table.Header is what actually freezes the
// column headers correctly while the body scrolls (fixed 2026-09-05 after a manual
// position:sticky-with-a-guessed-offset attempt turned out fragile), and gives every
// column a real drag-to-resize handle.
export function OrdersTable({ rows, stages }: { rows: OrderRow[]; stages: StageRow[] }) {
  const stageById = new Map(stages.map((s) => [s.id, s]));
  const buildLink = useLinkBuilder();
  const searchParams = useSearchParams();
  const currentSort = searchParams.get("sortBy") ?? undefined;
  const currentDir = (searchParams.get("sortDir") as "asc" | "desc" | null) ?? "desc";

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [tatSortDir, setTatSortDir] = useState<TatSortDir>(null);

  const sortedRows = useMemo(() => {
    if (!tatSortDir) return rows;
    return [...rows].sort((a, b) => {
      const av = tatSortValue(a);
      const bv = tatSortValue(b);
      if (av === null && bv === null) return 0;
      if (av === null) return 1; // nulls always last, regardless of direction
      if (bv === null) return -1;
      return tatSortDir === "desc" ? bv - av : av - bv;
    });
  }, [rows, tatSortDir]);

  function toggleTatSort() {
    setTatSortDir((prev) => (prev === null ? "desc" : prev === "desc" ? "asc" : null));
  }

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allSelected = rows.length > 0 && selectedIds.size === rows.length;
  function toggleSelectAll() {
    setSelectedIds(allSelected ? new Set() : new Set(rows.map((o) => o.id)));
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
    setCopyStatus(null);
  }

  async function copySelected() {
    const selected = rows.filter((o) => selectedIds.has(o.id));
    if (!selected.length) return;
    const ok = await copyToClipboard(buildClipboardRows(selected, stageById));
    setCopyStatus(
      ok
        ? `Copied ${selected.length} row${selected.length === 1 ? "" : "s"} — paste into Excel/email.`
        : "Couldn't copy — try selecting fewer rows or a different browser.",
    );
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
        <Table.ResizableContainer className="h-full overflow-y-auto overflow-x-auto rounded-xl border-2 border-border">
          <Table.Content aria-label="Orders">
            <Table.Header className="sticky top-0 z-10 bg-surface-secondary text-xs uppercase text-muted">
              {selectMode ? (
                <Table.Column id="select" defaultWidth={44} minWidth={44}>
                  <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} aria-label="Select all" />
                </Table.Column>
              ) : null}
              <Table.Column isRowHeader id="otn" defaultWidth={140} minWidth={110}>
                <SortableLabel column="otn" label="OTN / Item" currentSort={currentSort} currentDir={currentDir} buildLink={buildLink} />
                <Table.ColumnResizer />
              </Table.Column>
              <Table.Column id="merchant" defaultWidth={160} minWidth={110}>
                <SortableLabel column="merchant" label="Merchant" currentSort={currentSort} currentDir={currentDir} buildLink={buildLink} />
                <Table.ColumnResizer />
              </Table.Column>
              <Table.Column id="quality" defaultWidth={110} minWidth={80}>
                <SortableLabel column="quality" label="Quality" currentSort={currentSort} currentDir={currentDir} buildLink={buildLink} />
                <Table.ColumnResizer />
              </Table.Column>
              <Table.Column id="design" defaultWidth={130} minWidth={90}>
                <SortableLabel column="design" label="Design" currentSort={currentSort} currentDir={currentDir} buildLink={buildLink} />
                <Table.ColumnResizer />
              </Table.Column>
              <Table.Column id="size" defaultWidth={100} minWidth={70}>
                Size
                <Table.ColumnResizer />
              </Table.Column>
              <Table.Column id="construction" defaultWidth={120} minWidth={90}>
                Construction
                <Table.ColumnResizer />
              </Table.Column>
              {/* Stage is deliberately plain text, not sortable — a real attempt to sort
                  by the joined stage's display_order didn't actually work in practice
                  (confirmed live 2026-09-05), and rather than leave a sort control that
                  silently does nothing, it's removed until that's fixed for real. */}
              <Table.Column id="stage" defaultWidth={110} minWidth={90}>
                Stage
                <Table.ColumnResizer />
              </Table.Column>
              <Table.Column id="pendingDays" defaultWidth={120} minWidth={90}>
                <SortableLabel column="pendingDays" label="Days in Stage" currentSort={currentSort} currentDir={currentDir} buildLink={buildLink} />
                <Table.ColumnResizer />
              </Table.Column>
              <Table.Column id="stageStandard" defaultWidth={170} minWidth={130}>
                <TatSortableLabel dir={tatSortDir} onToggle={toggleTatSort} />
                <Table.ColumnResizer />
              </Table.Column>
              <Table.Column id="originalExFactory" defaultWidth={130} minWidth={100}>
                Original Ex Factory
                <Table.ColumnResizer />
              </Table.Column>
              <Table.Column id="salesOrderDate" defaultWidth={120} minWidth={100}>
                Sales Order Date
                <Table.ColumnResizer />
              </Table.Column>
              <Table.Column id="revisedExFactory" defaultWidth={130} minWidth={100}>
                <SortableLabel column="revisedExFactory" label="Rev. Ex-Factory" currentSort={currentSort} currentDir={currentDir} buildLink={buildLink} />
                <Table.ColumnResizer />
              </Table.Column>
              <Table.Column id="onTime" defaultWidth={100} minWidth={80}>
                On Time
              </Table.Column>
            </Table.Header>
            <Table.Body>
              {sortedRows.map((order) => {
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
                    <Table.Cell>{order.quality ?? "—"}</Table.Cell>
                    <Table.Cell>{order.design ?? "—"}</Table.Cell>
                    <Table.Cell>{order.size ?? "—"}</Table.Cell>
                    <Table.Cell>{order.construction ?? "—"}</Table.Cell>
                    <Table.Cell>
                      <StageChip code={stage?.code ?? null} label={stage?.display_name ?? "Unresolved"} />
                    </Table.Cell>
                    <Table.Cell>{order.current_status_pending_days ?? "—"}</Table.Cell>
                    <Table.Cell>
                      {standard.status === "on_hold" || standard.status === "no_standard" ? (
                        <span className="text-muted">—</span>
                      ) : (
                        <span className={standard.status === "breached" ? "font-medium text-danger" : "text-foreground"}>
                          {standard.standardDays}d
                        </span>
                      )}
                    </Table.Cell>
                    <Table.Cell>{order.original_ex_factory_date ?? "—"}</Table.Cell>
                    <Table.Cell>{order.sales_order_date ?? "—"}</Table.Cell>
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
        </Table.ResizableContainer>
      </Table>
    </div>
  );
}
