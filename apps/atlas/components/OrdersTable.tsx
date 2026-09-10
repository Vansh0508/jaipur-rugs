"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { Key, Selection } from "@heroui/react";
import { Table, Checkbox } from "@jaipur-rugs/ui-kit";
import { StageChip, OnTimeBadge } from "./StageChip";
import { ColumnVisibilityMenu, type ColumnDef } from "./ColumnVisibilityMenu";
import { SelectionActionBar } from "./SelectionActionBar";
import { onTimeStatus } from "@/lib/tat";
import { stageStandard } from "@/lib/stageTat";
import { resolveFollowUpPerson } from "@/lib/followUpPerson";
import { displayDate } from "@/lib/displayDate";
import { copyToClipboard, buildClipboardText, buildClipboardHtml } from "@/lib/clipboardCopy";
import { exportRowsToExcel } from "@/lib/exportToExcel";
import { useLocalPreference } from "@/lib/useLocalPreference";
import type { OrderRow, StageRow, SortableColumn } from "@/lib/queries/orders";

// Client component — needed for real client state (row selection, column visibility,
// the computed-column sort) and for building sort/page links locally off the current
// URL (useSearchParams), which Next.js doesn't allow passing as a function prop across
// the server/client boundary.
//
// displayDate lives in lib/displayDate.ts so RugLensTable can reuse it — see that
// file's comment for the original rationale.
//
// Selection/sorting/column-visibility rebuilt onto Hero UI's native Table primitives,
// 2026-09-10 (previously a hand-rolled `selectMode` boolean + manual checkbox column +
// link-based sort headers). Selection is no longer an opt-in mode — the checkbox
// column is always there, same as any real Hero UI selection table.

/** Total Days = today minus Sales Order Date — added 2026-09-07 per direct production
 * feedback on a real bug: "Days in Stage" only counts time in the current SUB-status
 * (e.g. "At Stores"), not the order's whole age. Real example given live: an order
 * showed "3 days" (days since it moved to Stores) when it had actually been sitting for
 * 34-39 days total since it was placed. This column is the simple, unambiguous total —
 * confirmed exact formula: "today minus mein sales order date". Deliberately not
 * sortable on its own: it's a direct function of Sales Order Date, which already is. */
function totalDaysSinceSalesOrder(salesOrderDate: string | null): number | null {
  if (!salesOrderDate || Number(salesOrderDate.slice(0, 4)) < 1900) return null;
  const startMs = new Date(`${salesOrderDate}T00:00:00Z`).getTime();
  if (Number.isNaN(startMs)) return null;
  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.max(0, Math.round((todayUtc - startMs) / (24 * 60 * 60 * 1000)));
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

type ComputedSortKind = "tat" | "onTime";
type ComputedSort = { kind: ComputedSortKind; dir: "asc" | "desc" } | null;

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

/** Worst-first ordinal for the On Time badge — "delayed" sorts above "late" sorts above
 * "unknown" sorts above "on_track", same worst-first convention as tatSortValue above. */
function onTimeSortValue(order: OrderRow, stageById: Map<string, StageRow>): number {
  const stage = order.stage_id ? stageById.get(order.stage_id) : undefined;
  const standard = stageStandard({
    rawCurrentStatus: order.raw_current_status,
    quality: order.quality,
    size: order.size,
    stdCubage: order.std_cubage,
    orderPriority: order.order_priority,
    onHold: order.on_hold,
    currentStatusPendingDays: order.current_status_pending_days,
  });
  const status = onTimeStatus(
    order.promised_delivery_date,
    order.revised_ex_factory_date,
    stage?.is_terminal ?? false,
    standard.standardDays,
  );
  return status === "delayed" ? 3 : status === "late" ? 2 : status === "unknown" ? 1 : 0;
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
 * carry the selection's HTML formatting and works without a secure context.
 *
 * copyToClipboard/buildClipboardText/buildClipboardHtml moved to lib/clipboardCopy.ts,
 * 2026-09-10, so RugLensTable can produce output in this exact same format — see that
 * file's comment. Behavior here is unchanged; only the mechanics moved. */
const RUG_TRACKING_HEADERS = [
  "OTN No_", "Item No_", "Sales Order No_", "Customer No_", "Quality", "Design",
  "GR Color Name", "BR Color Name", "Shape", "Size", "Construction", "Serial No_",
  "Std Cubage", "Current Status", "Stage", "Days in Stage", "Original Ex Factory",
  "Sales Order Date", "Rev Ex-Factory",
];

/** Columns included when copying selected rows — the exact real workflow already
 * happening by hand today (see the GACHOT/Artemest dispatch-email screenshot this was
 * built from): someone manually re-typing a rug table into an email every time. Matches
 * the old tool's own "Copy for NAV (Excel row)" precedent, generalized from one order to
 * whichever rows are selected, and widened to the fuller field set real dispatch emails
 * actually carry (GR/BR color, shape, serial no, std cubage) rather than just NAV's own
 * narrower payload shape. */
function clipboardCells(o: OrderRow, stageById: Map<string, StageRow>): (string | number | null)[] {
  const stage = o.stage_id ? stageById.get(o.stage_id) : undefined;
  return [
    o.otn_no, o.item_no, o.sales_order_no, o.customer_no, o.quality, o.design,
    o.gr_color_name, o.br_color_name, o.shape, o.size, o.construction, o.serial_no,
    o.std_cubage, o.raw_current_status, stage?.display_name ?? "",
    o.current_status_pending_days,
    displayDate(o.original_ex_factory_date), displayDate(o.sales_order_date), displayDate(o.revised_ex_factory_date),
  ];
}

function buildClipboardRows(selected: OrderRow[], stageById: Map<string, StageRow>): string {
  return buildClipboardText(RUG_TRACKING_HEADERS, selected.map((o) => clipboardCells(o, stageById)));
}

function buildOrdersClipboardHtml(selected: OrderRow[], stageById: Map<string, StageRow>): string {
  return buildClipboardHtml(RUG_TRACKING_HEADERS, selected.map((o) => clipboardCells(o, stageById)));
}

/** Same column shape as ExportOrdersButton.tsx's whole-list export — kept as a
 * deliberate duplicate rather than a shared import, so the top-level "export
 * everything" button and this selection-only export can evolve independently if they
 * ever need to. */
function exportCells(o: OrderRow, stageNameById: Map<string, string>) {
  return {
    "OTN No.": o.otn_no,
    "Item No.": o.item_no,
    "Sales Order No.": o.sales_order_no,
    "Customer No.": o.customer_no,
    "Merchant Name": o.merchant_name,
    Stage: o.stage_id ? stageNameById.get(o.stage_id) ?? "" : "",
    "Current Status (ERP)": o.raw_current_status,
    "Days in Current Status": o.current_status_pending_days,
    Quality: o.quality,
    Design: o.design,
    Size: o.size,
    "Sales Order Date": o.sales_order_date,
    "Promised Delivery Date": o.promised_delivery_date,
    "Follow Up Person": o.follow_up_person,
    "Salesperson Code": o.salesperson_code,
  };
}

/** Every column this table can show, in display order — the single source of truth
 * both the header row and each body row render from (via the same filtered id list),
 * so a hidden column can never desync header/cell counts. `sortable: true` covers both
 * real DB-backed columns (SORTABLE_COLUMNS in lib/queries/orders.ts — a URL navigation
 * re-fetches the sorted set) and the two computed ones, Stage Standard/On Time (a
 * client-side re-sort of whatever page is already loaded) — see handleSortChange. */
const ALL_COLUMNS: (ColumnDef & { defaultWidth: number; minWidth: number; sortable?: boolean })[] = [
  { id: "otn", label: "OTN / Item", defaultWidth: 140, minWidth: 110, sortable: true },
  { id: "merchant", label: "Merchant", defaultWidth: 160, minWidth: 110, sortable: true },
  { id: "customerPo", label: "Customer PO", defaultWidth: 130, minWidth: 100, sortable: true },
  { id: "salesPerson", label: "Sales Person", defaultWidth: 150, minWidth: 110, sortable: true },
  { id: "quality", label: "Quality", defaultWidth: 110, minWidth: 80, sortable: true },
  { id: "design", label: "Design", defaultWidth: 130, minWidth: 90, sortable: true },
  { id: "size", label: "Size", defaultWidth: 100, minWidth: 70, sortable: true },
  { id: "construction", label: "Construction", defaultWidth: 120, minWidth: 90, sortable: true },
  // Stage isn't sortable — a real attempt at sorting it by the joined stages.display_order
  // didn't actually work in practice (confirmed live 2026-09-05) and was removed rather
  // than left silently broken.
  { id: "stage", label: "Stage", defaultWidth: 110, minWidth: 90 },
  { id: "pendingDays", label: "Days in Stage", defaultWidth: 120, minWidth: 90, sortable: true },
  // Not sortable on its own — see totalDaysSinceSalesOrder's comment; sort by Sales
  // Order Date for the same ordering.
  { id: "totalDays", label: "Total Days", defaultWidth: 110, minWidth: 90 },
  { id: "stageStandard", label: "Stage Standard (TAT)", defaultWidth: 170, minWidth: 130, sortable: true },
  { id: "originalExFactory", label: "Original Ex Factory", defaultWidth: 130, minWidth: 100, sortable: true },
  { id: "salesOrderDate", label: "Sales Order Date", defaultWidth: 120, minWidth: 100, sortable: true },
  { id: "revisedExFactory", label: "Rev. Ex-Factory", defaultWidth: 130, minWidth: 100, sortable: true },
  { id: "revisedExIndia", label: "Rev. Ex-India", defaultWidth: 120, minWidth: 100, sortable: true },
  { id: "currentLocation", label: "Current Location", defaultWidth: 150, minWidth: 110, sortable: true },
  // Not sortable — this column shows a computed value (see the cell below), not the
  // raw orders.follow_up_person column, so a server-side sort by that column wouldn't
  // match what's actually displayed. Same reasoning as Stage.
  { id: "followUpPerson", label: "Follow Up Person", defaultWidth: 160, minWidth: 120 },
  { id: "onTime", label: "On Time", defaultWidth: 100, minWidth: 80, sortable: true },
];

export function OrdersTable({
  rows,
  stages,
  followUpPersonEmails,
}: {
  rows: OrderRow[];
  stages: StageRow[];
  /** Name -> email, for the Follow Up Person column's hover/click-to-copy — display
   * convenience only, not the (still-unbuilt) automated alert routing. A name with no
   * entry here just has no confirmed email on file; never guessed client-side either. */
  followUpPersonEmails: Record<string, string>;
}) {
  const stageById = useMemo(() => new Map(stages.map((s) => [s.id, s])), [stages]);
  const stageNameById = useMemo(() => new Map(stages.map((s) => [s.id, s.display_name])), [stages]);
  const buildLink = useLinkBuilder();
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentSort = searchParams.get("sortBy") ?? undefined;
  const currentDir = (searchParams.get("sortDir") as "asc" | "desc" | null) ?? "desc";

  const [selectedKeys, setSelectedKeys] = useState<Selection>(new Set<Key>());
  const [computedSort, setComputedSort] = useState<ComputedSort>(null);
  const [hiddenColumns, setHiddenColumns] = useLocalPreference<string[]>("atlas:orders:columns", []);
  const hidden = useMemo(() => new Set(hiddenColumns), [hiddenColumns]);
  const visibleColumns = useMemo(() => ALL_COLUMNS.filter((c) => !hidden.has(c.id)), [hidden]);
  // Which row's Follow Up Person email was just copied — flashes "Copied" on that one
  // cell for 1.5s, keyed by order id so it never de-syncs across the two lookups
  // sharing the same name (e.g. two orders both "SURENDRA DHAKAD").
  const [copiedEmailOrderId, setCopiedEmailOrderId] = useState<string | null>(null);

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

  // Unified sort state driving Hero UI's native sortable headers — real DB-backed
  // columns reflect the URL's sortBy/sortDir; the two computed columns (Stage
  // Standard/On Time) reflect `computedSort`; only one of the two mechanisms is ever
  // active at a time, matching the original behavior.
  const activeSortColumn = computedSort ? (computedSort.kind === "tat" ? "stageStandard" : "onTime") : currentSort;
  const activeSortDir = computedSort ? computedSort.dir : currentDir;
  function sortDirFor(columnId: string): "ascending" | "descending" | undefined {
    if (activeSortColumn !== columnId) return undefined;
    return activeSortDir === "desc" ? "descending" : "ascending";
  }

  /** An inactive column always starts from descending, matching every sortable header
   * before this rewrite; clicking the SAME column again flips it. Hero UI/react-aria's
   * own default toggle (ascending-first) is overridden here to preserve that. */
  function handleSortChange(descriptor: { column: Key; direction: "ascending" | "descending" }) {
    const columnId = String(descriptor.column);
    const isSameColumn = activeSortColumn === columnId;
    const dir: "asc" | "desc" = isSameColumn ? (descriptor.direction === "descending" ? "desc" : "asc") : "desc";

    if (columnId === "stageStandard") {
      setComputedSort({ kind: "tat", dir });
      return;
    }
    if (columnId === "onTime") {
      setComputedSort({ kind: "onTime", dir });
      return;
    }
    setComputedSort(null);
    router.push(buildLink({ sortBy: columnId, sortDir: dir, page: undefined }));
  }

  const selectedCount = selectedKeys === "all" ? rows.length : selectedKeys.size;
  function selectedRows(): OrderRow[] {
    if (selectedKeys === "all") return rows;
    return rows.filter((o) => (selectedKeys as Set<Key>).has(o.id));
  }

  async function handleCopySelected(): Promise<boolean> {
    const selected = selectedRows();
    if (!selected.length) return false;
    return copyToClipboard(buildClipboardRows(selected, stageById), buildOrdersClipboardHtml(selected, stageById));
  }

  function handleExportSelected() {
    const selected = selectedRows();
    if (!selected.length) return;
    exportRowsToExcel(
      selected.map((o) => exportCells(o, stageNameById)),
      "Orders",
      `atlas-orders-selected-${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  }

  async function copyFollowUpPersonEmail(orderId: string, email: string) {
    const ok = await copyToClipboard(email, email);
    if (ok) {
      setCopiedEmailOrderId(orderId);
      setTimeout(() => setCopiedEmailOrderId((current) => (current === orderId ? null : current)), 1500);
    }
  }

  if (!rows.length) {
    return <p className="rounded-xl border-2 border-border p-8 text-center text-sm text-muted">No orders match these filters.</p>;
  }

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex shrink-0 items-center gap-3">
        <ColumnVisibilityMenu columns={ALL_COLUMNS} hidden={hidden} onChange={(next) => setHiddenColumns([...next])} />
      </div>

      {/* `relative` so SelectionActionBar (an `absolute`-positioned floating bar) sits
          over this table area specifically, not the whole viewport. */}
      <div className="relative h-full min-h-0 flex-1">
        {/* Real Table component (Hero UI, via @jaipur-rugs/ui-kit), not a hand-rolled
            <table> — Table.ResizableContainer + sticky Table.Header freezes the column
            headers correctly while the body scrolls, and gives every column a real
            drag-to-resize handle.

            variant="secondary" — Hero UI's default ("primary") deliberately wraps the
            table in its own gray padded card with a large border-radius (the actual
            white table renders as an inset card inside that), by design. Stacked with
            our own rounded-xl border-2 on ResizableContainer below, that produced three
            nested visual boundaries — direct feedback, 2026-09-07: "there is one table
            behind also from the original table" (a visible shadow/duplicate-card look,
            not a data issue). "secondary" has no root background/padding/rounding of
            its own, leaving just the one border we already draw.

            selectionMode="multiple" + selectionBehavior="toggle" is native Hero UI
            table selection, 2026-09-10 (previously a hand-rolled selectMode boolean) —
            always on, not an opt-in mode; sortDescriptor/onSortChange similarly
            replace the old link/button-based sort headers with the table's own. */}
        <Table variant="secondary" className="h-full min-h-0 flex-1">
          <Table.ResizableContainer className="h-full overflow-y-auto overflow-x-auto rounded-xl border-2 border-border">
            <Table.Content
              aria-label="Orders"
              selectionMode="multiple"
              selectionBehavior="toggle"
              selectedKeys={selectedKeys}
              onSelectionChange={setSelectedKeys}
              sortDescriptor={activeSortColumn ? { column: activeSortColumn, direction: activeSortDir === "desc" ? "descending" : "ascending" } : undefined}
              onSortChange={handleSortChange}
            >
              <Table.Header className="sticky top-0 z-10 bg-surface-secondary text-xs uppercase text-muted">
                <Table.Column id="select" defaultWidth={44} minWidth={44}>
                  <Checkbox slot="selection">
                    <Checkbox.Content>
                      <Checkbox.Control>
                        <Checkbox.Indicator />
                      </Checkbox.Control>
                    </Checkbox.Content>
                  </Checkbox>
                </Table.Column>
                {visibleColumns.map((col, i) => (
                  <Table.Column
                    key={col.id}
                    id={col.id}
                    isRowHeader={i === 0}
                    allowsSorting={col.sortable}
                    defaultWidth={col.defaultWidth}
                    minWidth={col.minWidth}
                  >
                    {col.sortable ? <Table.SortableColumnHeader sortDirection={sortDirFor(col.id)}>{col.label}</Table.SortableColumnHeader> : col.label}
                    {i < visibleColumns.length - 1 ? <Table.ColumnResizer /> : null}
                  </Table.Column>
                ))}
              </Table.Header>
              <Table.Body>
                {sortedRows.map((order) => {
                  const stage = order.stage_id ? stageById.get(order.stage_id) : undefined;
                  const standard = stageStandard({
                    rawCurrentStatus: order.raw_current_status,
                    quality: order.quality,
                    size: order.size,
                    stdCubage: order.std_cubage,
                    orderPriority: order.order_priority,
                    onHold: order.on_hold,
                    currentStatusPendingDays: order.current_status_pending_days,
                  });
                  const status = onTimeStatus(
                    order.promised_delivery_date,
                    order.revised_ex_factory_date,
                    stage?.is_terminal ?? false,
                    standard.standardDays,
                  );

                  const cellsById: Record<string, React.ReactNode> = {
                    otn: (
                      <>
                        <Link href={`/orders/${order.id}`} className="font-medium text-accent hover:underline">
                          {order.otn_no}
                        </Link>
                        <div className="text-xs text-muted">{order.item_no}</div>
                      </>
                    ),
                    merchant: (
                      <>
                        <div>{order.merchant_name ?? "—"}</div>
                        <div className="text-xs text-muted">{order.customer_no ?? "—"}</div>
                      </>
                    ),
                    customerPo: order.customer_po_no ?? "—",
                    salesPerson: order.order_wise_merchant ?? "—",
                    quality: order.quality ?? "—",
                    design: order.design ?? "—",
                    size: order.size ?? "—",
                    construction: order.construction ?? "—",
                    stage: <StageChip code={stage?.code ?? null} label={stage?.display_name ?? "Unresolved"} />,
                    pendingDays: order.current_status_pending_days ?? "—",
                    totalDays: totalDaysSinceSalesOrder(order.sales_order_date) ?? "—",
                    stageStandard:
                      standard.status === "on_hold" || standard.status === "no_standard" ? (
                        <span className="text-muted">—</span>
                      ) : (
                        <span className={standard.status === "breached" ? "font-medium text-danger" : "text-foreground"}>{standard.standardDays}d</span>
                      ),
                    originalExFactory: displayDate(order.original_ex_factory_date),
                    salesOrderDate: displayDate(order.sales_order_date),
                    // revised_ex_factory_date, not promised_delivery_date — this is the
                    // actual delay/expectancy signal, and what onTimeStatus above uses
                    // primarily (promised_delivery_date is real data since the NAV
                    // switch, 2026-09-07, but often years later than Rev Ex Factory —
                    // a different field, not a better version of this one).
                    revisedExFactory: displayDate(order.revised_ex_factory_date),
                    revisedExIndia: displayDate(order.revised_ex_india_date),
                    currentLocation: order.current_location ?? "—",
                    followUpPerson: (() => {
                      // Computed from the real Zone x Priority x Quality-type routing
                      // table (lib/followUpPerson.ts), NOT orders.follow_up_person —
                      // explicit instruction, 2026-09-07: "dont take NAV data for
                      // follow up person. refer to only [Ex India.xlsx]".
                      const person = resolveFollowUpPerson({
                        rawCurrentStatus: order.raw_current_status,
                        quality: order.quality,
                        customerServiceZone: order.customer_service_zone,
                        orderPriority: order.order_priority,
                        customerNo: order.customer_no,
                      });
                      if (!person) return <span className="text-muted">—</span>;
                      const email = followUpPersonEmails[person];
                      if (!email) {
                        return (
                          <span title="No email on file for this name" className="text-muted">
                            {person}
                          </span>
                        );
                      }
                      const justCopied = copiedEmailOrderId === order.id;
                      return (
                        <button
                          type="button"
                          title={justCopied ? "Copied!" : `${email} — click to copy`}
                          onClick={() => copyFollowUpPersonEmail(order.id, email)}
                          className="text-left hover:underline"
                        >
                          {justCopied ? "Copied!" : person}
                        </button>
                      );
                    })(),
                    onTime: <OnTimeBadge status={status} />,
                  };

                  return (
                    <Table.Row key={order.id} id={order.id}>
                      <Table.Cell>
                        <Checkbox slot="selection">
                          <Checkbox.Content>
                            <Checkbox.Control>
                              <Checkbox.Indicator />
                            </Checkbox.Control>
                          </Checkbox.Content>
                        </Checkbox>
                      </Table.Cell>
                      {visibleColumns.map((col) => (
                        <Table.Cell key={col.id}>{cellsById[col.id]}</Table.Cell>
                      ))}
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table.Content>
          </Table.ResizableContainer>
        </Table>

        <SelectionActionBar
          count={selectedCount}
          onCopy={handleCopySelected}
          onExport={handleExportSelected}
          onClear={() => setSelectedKeys(new Set())}
        />
      </div>
    </div>
  );
}
