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

/** A handful of date columns display the raw ERP value directly (unlike onTimeStatus/
 * stageStandard, which already compute against it) — this keeps those displays (and the
 * copy-to-Excel/email output) from showing "1753-01-01" (SQL Server's DateTime.MinValue,
 * the ERP's own "no date set" placeholder, confirmed live 2026-09-07) as if it were a
 * real date. orders-sync.mjs now converts this to null at the source going forward, but
 * rows not yet re-synced still carry the stale value until the next sync run. */
function displayDate(value: string | null | undefined): string {
  if (!value) return "—";
  return Number(value.slice(0, 4)) < 1900 ? "—" : value;
}

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

type ComputedSortKind = "tat" | "onTime";
type ComputedSort = { kind: ComputedSortKind; dir: "asc" | "desc" } | null;

/** Stage Standard (TAT) and On Time are both computed values, not real columns — there's
 * nothing in the database to ask Postgres to sort by, so unlike every other sortable
 * column here, these two only re-order whatever page of rows is already loaded
 * (client-side), not the full filtered/paginated set. Only one of the two can be active
 * at once (clicking one takes over from the other), matching how the server-side sort
 * links above also only ever have one active column. Null always sorts last regardless
 * of direction, matching every other sort in this app. */
function ComputedSortableLabel({
  label,
  kind,
  computedSort,
  onToggle,
}: {
  label: string;
  kind: ComputedSortKind;
  computedSort: ComputedSort;
  onToggle: (kind: ComputedSortKind) => void;
}) {
  const isActive = computedSort?.kind === kind;
  return (
    <button type="button" onClick={() => onToggle(kind)} className="flex items-center gap-1 hover:text-foreground">
      {label}
      <span className="text-[10px]">{isActive ? (computedSort!.dir === "desc" ? "▼" : "▲") : "⇅"}</span>
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
    revisedExFactoryDate: order.revised_ex_factory_date,
  });
  if (standard.standardDays === null) return null;
  return (order.current_status_pending_days ?? 0) - standard.standardDays;
}

/** Worst-first ordinal for the On Time badge — "delayed" sorts above "unknown" sorts
 * above "on_track", same worst-first convention as tatSortValue above. */
function onTimeSortValue(order: OrderRow, stageById: Map<string, StageRow>): number {
  const stage = order.stage_id ? stageById.get(order.stage_id) : undefined;
  const status = onTimeStatus(order.promised_delivery_date, order.revised_ex_factory_date, stage?.is_terminal ?? false);
  return status === "delayed" ? 2 : status === "unknown" ? 1 : 0;
}

/** Copies BOTH a plain-text (tab-separated) and a real HTML `<table>` representation of
 * the same rows onto the clipboard at once. Direct feedback, 2026-09-06: pasting the
 * old plain-text-only copy straight into an Outlook email showed up as raw
 * tab-separated text (see the real GACHOT/Artemest dispatch-email screenshot this was
 * built from), not a formatted table — Outlook (and Word, and rich-text email bodies
 * generally) reads the clipboard's HTML flavor when one's present, so without it there
 * was no way to get an actual bordered table by pasting directly into a mail body.
 * Excel/plain editors still get the tab-separated flavor exactly as before — browsers
 * expose the full multi-flavor clipboard item to every paste target,
 * each one just picks whichever flavor it understands.
 *
 * navigator.clipboard.write (multi-flavor) needs a secure context (HTTPS, or localhost)
 * — now true for atlas.jaipurrugsai.cloud, but NOT the plain-HTTP office server
 * (confirmed live 2026-09-05: writeText failed there for exactly this reason, same root
 * cause as the earlier login-cookie bug). Falls back to a hidden CONTENTEDITABLE div
 * (not a plain textarea — a textarea can only ever carry plain text) holding the real
 * HTML, selected via Range/Selection and copied with execCommand("copy"), which does
 * carry the selection's HTML formatting and works without a secure context. */
async function copyToClipboard(text: string, html: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard && typeof ClipboardItem !== "undefined" && window.isSecureContext) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/plain": new Blob([text], { type: "text/plain" }),
          "text/html": new Blob([html], { type: "text/html" }),
        }),
      ]);
      return true;
    } catch {
      // fall through to the contenteditable approach below
    }
  }
  try {
    const holder = document.createElement("div");
    holder.contentEditable = "true";
    holder.style.position = "fixed";
    holder.style.opacity = "0";
    holder.innerHTML = html;
    document.body.appendChild(holder);
    const range = document.createRange();
    range.selectNodeContents(holder);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    const ok = document.execCommand("copy");
    selection?.removeAllRanges();
    document.body.removeChild(holder);
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
        o.current_status_pending_days,
        displayDate(o.original_ex_factory_date), displayDate(o.sales_order_date), displayDate(o.revised_ex_factory_date),
      ]
        .map((v) => (v === null || v === undefined ? "" : String(v)))
        .join("\t"),
    );
  }
  return lines.join("\n");
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Same rows/columns as buildClipboardRows above, as a real HTML `<table>` instead of
 * tab-separated text — see copyToClipboard's doc for why both are needed. Inline
 * `border` attributes/styles (not a <style> block or CSS classes) deliberately: Outlook
 * and most email clients strip <style> blocks and class-based styling from pasted/sent
 * HTML, but keep inline styles, so this is the only reliable way for the table to
 * actually show its borders once pasted into a real email body rather than one used
 * only within the browser itself. */
function buildClipboardHtml(selected: OrderRow[], stageById: Map<string, StageRow>): string {
  const headers = [
    "OTN No_", "Item No_", "Sales Order No_", "Customer No_", "Quality", "Design",
    "GR Color Name", "BR Color Name", "Shape", "Size", "Construction", "Serial No_",
    "Std Cubage", "Current Status", "Stage", "Days in Stage", "Original Ex Factory",
    "Sales Order Date", "Rev Ex-Factory",
  ];
  const cellStyle = "border:1px solid #999;padding:4px 8px;font-family:Calibri,Arial,sans-serif;font-size:11pt;";
  const headStyle = `${cellStyle}background:#f2f2f2;font-weight:bold;text-align:left;`;
  const headerRow = `<tr>${headers.map((h) => `<th style="${headStyle}">${escapeHtml(h)}</th>`).join("")}</tr>`;
  const bodyRows = selected
    .map((o) => {
      const stage = o.stage_id ? stageById.get(o.stage_id) : undefined;
      const cells = [
        o.otn_no, o.item_no, o.sales_order_no, o.customer_no, o.quality, o.design,
        o.gr_color_name, o.br_color_name, o.shape, o.size, o.construction, o.serial_no,
        o.std_cubage, o.raw_current_status, stage?.display_name ?? "",
        o.current_status_pending_days,
        displayDate(o.original_ex_factory_date), displayDate(o.sales_order_date), displayDate(o.revised_ex_factory_date),
      ];
      return `<tr>${cells
        .map((v) => `<td style="${cellStyle}">${escapeHtml(v === null || v === undefined ? "" : String(v))}</td>`)
        .join("")}</tr>`;
    })
    .join("");
  return `<table style="border-collapse:collapse;">${headerRow}${bodyRows}</table>`;
}

// Real Table component (Hero UI, via @jaipur-rugs/ui-kit), not a hand-rolled <table> —
// its Table.ResizableContainer + sticky Table.Header is what actually freezes the
// column headers correctly while the body scrolls (fixed 2026-09-05 after a manual
// position:sticky-with-a-guessed-offset attempt turned out fragile), and gives every
// column a real drag-to-resize handle.
export function OrdersTable({ rows, stages }: { rows: OrderRow[]; stages: StageRow[] }) {
  const stageById = useMemo(() => new Map(stages.map((s) => [s.id, s])), [stages]);
  const buildLink = useLinkBuilder();
  const searchParams = useSearchParams();
  const currentSort = searchParams.get("sortBy") ?? undefined;
  const currentDir = (searchParams.get("sortDir") as "asc" | "desc" | null) ?? "desc";

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [computedSort, setComputedSort] = useState<ComputedSort>(null);

  const sortedRows = useMemo(() => {
    if (!computedSort) return rows;
    const valueFor = (order: OrderRow) =>
      computedSort.kind === "tat" ? tatSortValue(order) : onTimeSortValue(order, stageById);
    return [...rows].sort((a, b) => {
      const av = valueFor(a);
      const bv = valueFor(b);
      if (av === null && bv === null) return 0;
      if (av === null) return 1; // nulls always last, regardless of direction
      if (bv === null) return -1;
      return computedSort.dir === "desc" ? bv - av : av - bv;
    });
  }, [rows, computedSort, stageById]);

  function toggleComputedSort(kind: ComputedSortKind) {
    setComputedSort((prev) => {
      if (!prev || prev.kind !== kind) return { kind, dir: "desc" };
      if (prev.dir === "desc") return { kind, dir: "asc" };
      return null;
    });
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
    const ok = await copyToClipboard(buildClipboardRows(selected, stageById), buildClipboardHtml(selected, stageById));
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
                <SortableLabel column="size" label="Size" currentSort={currentSort} currentDir={currentDir} buildLink={buildLink} />
                <Table.ColumnResizer />
              </Table.Column>
              <Table.Column id="construction" defaultWidth={120} minWidth={90}>
                <SortableLabel column="construction" label="Construction" currentSort={currentSort} currentDir={currentDir} buildLink={buildLink} />
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
                <ComputedSortableLabel label="Stage Standard (TAT)" kind="tat" computedSort={computedSort} onToggle={toggleComputedSort} />
                <Table.ColumnResizer />
              </Table.Column>
              <Table.Column id="originalExFactory" defaultWidth={130} minWidth={100}>
                <SortableLabel column="originalExFactory" label="Original Ex Factory" currentSort={currentSort} currentDir={currentDir} buildLink={buildLink} />
                <Table.ColumnResizer />
              </Table.Column>
              <Table.Column id="salesOrderDate" defaultWidth={120} minWidth={100}>
                <SortableLabel column="salesOrderDate" label="Sales Order Date" currentSort={currentSort} currentDir={currentDir} buildLink={buildLink} />
                <Table.ColumnResizer />
              </Table.Column>
              <Table.Column id="revisedExFactory" defaultWidth={130} minWidth={100}>
                <SortableLabel column="revisedExFactory" label="Rev. Ex-Factory" currentSort={currentSort} currentDir={currentDir} buildLink={buildLink} />
                <Table.ColumnResizer />
              </Table.Column>
              <Table.Column id="onTime" defaultWidth={100} minWidth={80}>
                <ComputedSortableLabel label="On Time" kind="onTime" computedSort={computedSort} onToggle={toggleComputedSort} />
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
    revisedExFactoryDate: order.revised_ex_factory_date,
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
                    <Table.Cell>{displayDate(order.original_ex_factory_date)}</Table.Cell>
                    <Table.Cell>{displayDate(order.sales_order_date)}</Table.Cell>
                    {/* revised_ex_factory_date, not promised_delivery_date — this is the
                        actual delay/expectancy signal, and what onTimeStatus above uses
                        primarily (see its own doc: promised_delivery_date is now real
                        data since the NAV switch, 2026-09-07, but often years later than
                        Rev Ex Factory — a different field, not a better version of this
                        one). */}
                    <Table.Cell>{displayDate(order.revised_ex_factory_date)}</Table.Cell>
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
