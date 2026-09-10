"use client";

import { useMemo, useState } from "react";
import { Table, Modal } from "@jaipur-rugs/ui-kit";
import { displayDate } from "@/lib/displayDate";
import { copyToClipboard, buildClipboardText, buildClipboardHtml } from "@/lib/clipboardCopy";
import type { RugLensRow } from "@/lib/queries/rugLens";
import type { StageRow } from "@/lib/queries/orders";

// Same select-rows-and-copy pattern as OrdersTable.tsx, reusing its exact clipboard
// format (see lib/clipboardCopy.ts) — confirmed directly, 2026-09-10: Ayaan wants the
// SAME columns/paste-into-Excel-or-email format the Orders tracker's copy feature
// already produces, not a different one just for RugLens.
const RUG_TRACKING_HEADERS = [
  "OTN No_", "Item No_", "Sales Order No_", "Customer No_", "Quality", "Design",
  "GR Color Name", "BR Color Name", "Shape", "Size", "Construction", "Serial No_",
  "Std Cubage", "Current Status", "Stage", "Days in Stage", "Original Ex Factory",
  "Sales Order Date", "Rev Ex-Factory",
  // RugLens-specific extra columns, added at the end per direct feedback, 2026-09-10 —
  // these deliberately duplicate Customer No_ (already above, matching Orders' format)
  // and add the two filter conditions themselves, so a copied row visibly shows WHICH
  // of the 5 stock codes it is and confirms it's actually PO/hold-blank, not just
  // relying on "it passed the filter." "Hold Remarks" is really `on_hold`'s raw value —
  // see lib/queries/rugLens.ts's header comment: there's no separate remarks field in
  // the data model, so this will read blank/"0"/"No" for every row here by
  // construction (the filter already excludes anything else) — that's expected, not a
  // bug, not a sign the column is broken.
  "Customer Code", "Hold Remarks", "Customer PO",
];

function clipboardCells(o: RugLensRow, stageById: Map<string, StageRow>): (string | number | null)[] {
  const stage = o.stage_id ? stageById.get(o.stage_id) : undefined;
  return [
    o.otn_no, o.item_no, o.sales_order_no, o.customer_no, o.quality, o.design,
    o.gr_color_name, o.br_color_name, o.shape, o.size, o.construction, o.serial_no,
    o.std_cubage, o.raw_current_status, stage?.display_name ?? "",
    o.current_status_pending_days,
    displayDate(o.original_ex_factory_date), displayDate(o.sales_order_date), displayDate(o.revised_ex_factory_date),
    o.customer_no, o.on_hold, o.customer_po_no,
  ];
}

/** Same route both the thumbnail and the enlarged lightbox view hit — the API route
 * always returns the original file bytes untouched (see app/api/rug-lens/photo/route.ts,
 * "full original quality" — no server-side resize), so the only difference between the
 * thumbnail and the lightbox is CSS sizing, not a second, bigger request. */
function photoUrl(design: string, gr: string | null, br: string | null): string {
  const params = new URLSearchParams({ design });
  if (gr) params.set("gr", gr);
  if (br) params.set("br", br);
  return `/api/rug-lens/photo?${params.toString()}`;
}

/** Photo cell — points straight at the live read-through API route (see
 * app/api/rug-lens/photo/route.ts). Deliberately just an <img>, no client-side
 * matching logic here: the route does the real Design+GR+BR match server-side (it's
 * the only side that can actually reach the J-Vault share) and this just requests it.
 * A row with no matching photo (or the route being unreachable, e.g. from the public
 * deployment — see that route's header comment) shows a plain placeholder rather than
 * a broken-image icon, via onError. Clicking it opens the same image full-size — see
 * the lightbox at the bottom of RugLensTable, added per direct feedback, 2026-09-10. */
function PhotoCell({
  design,
  gr,
  br,
  onOpen,
}: {
  design: string | null;
  gr: string | null;
  br: string | null;
  onOpen: () => void;
}) {
  const [failed, setFailed] = useState(false);
  if (!design || failed) {
    return <div className="flex h-16 w-14 shrink-0 items-center justify-center rounded border-2 border-dashed border-border text-[10px] text-muted">No photo</div>;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- server-only route, not a
    // static/optimizable asset next/image can handle.
    <img
      src={photoUrl(design, gr, br)}
      alt={`${design} ${gr ?? ""} ${br ?? ""}`.trim()}
      className="h-16 w-14 shrink-0 cursor-zoom-in rounded border-2 border-border object-cover transition hover:opacity-80"
      onError={() => setFailed(true)}
      onClick={onOpen}
    />
  );
}

export function RugLensTable({ rows, stages }: { rows: RugLensRow[]; stages: StageRow[] }) {
  const stageById = useMemo(() => new Map(stages.map((s) => [s.id, s])), [stages]);

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  // The row currently shown full-size in the lightbox — null when closed. Clicking the
  // row itself (not just the thumbnail) also opens it, per direct feedback, 2026-09-10.
  const [enlarged, setEnlarged] = useState<RugLensRow | null>(null);

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
    setSelectedIds(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
    setCopyStatus(null);
  }

  async function copySelected() {
    const selected = rows.filter((r) => selectedIds.has(r.id));
    if (!selected.length) return;
    const cells = selected.map((r) => clipboardCells(r, stageById));
    const ok = await copyToClipboard(
      buildClipboardText(RUG_TRACKING_HEADERS, cells),
      buildClipboardHtml(RUG_TRACKING_HEADERS, cells),
    );
    setCopyStatus(
      ok
        ? `Copied ${selected.length} row${selected.length === 1 ? "" : "s"} — paste into Excel/email.`
        : "Couldn't copy — try selecting fewer rows or a different browser.",
    );
    setTimeout(() => setCopyStatus(null), 3000);
  }

  if (!rows.length) {
    return <p className="rounded-xl border-2 border-border p-8 text-center text-sm text-muted">No open stock matches these filters.</p>;
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

      <Table variant="secondary" className="h-full min-h-0 flex-1">
        <Table.ResizableContainer className="h-full overflow-y-auto overflow-x-auto rounded-xl border-2 border-border">
          <Table.Content aria-label="Open stock / samples">
            <Table.Header className="sticky top-0 z-10 bg-surface-secondary text-xs uppercase text-muted">
              {selectMode ? (
                <Table.Column id="select" defaultWidth={44} minWidth={44}>
                  <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} aria-label="Select all" />
                </Table.Column>
              ) : null}
              <Table.Column isRowHeader id="photo" defaultWidth={90} minWidth={80}>
                Photo
              </Table.Column>
              <Table.Column id="design" defaultWidth={130} minWidth={90}>
                Design
                <Table.ColumnResizer />
              </Table.Column>
              <Table.Column id="grColor" defaultWidth={120} minWidth={90}>
                GR Color
                <Table.ColumnResizer />
              </Table.Column>
              <Table.Column id="brColor" defaultWidth={120} minWidth={90}>
                BR Color
                <Table.ColumnResizer />
              </Table.Column>
              <Table.Column id="quality" defaultWidth={110} minWidth={80}>
                Quality
                <Table.ColumnResizer />
              </Table.Column>
              <Table.Column id="size" defaultWidth={100} minWidth={70}>
                Size
                <Table.ColumnResizer />
              </Table.Column>
              <Table.Column id="location" defaultWidth={180} minWidth={130}>
                Location
                <Table.ColumnResizer />
              </Table.Column>
              <Table.Column id="itemNo" defaultWidth={130} minWidth={100}>
                Item No.
                <Table.ColumnResizer />
              </Table.Column>
              <Table.Column id="serialNo" defaultWidth={130} minWidth={100}>
                Serial No.
                <Table.ColumnResizer />
              </Table.Column>
              {/* Added per direct feedback, 2026-09-10 — see the clipboard headers'
                  comment above for why these three specifically, and the "Hold
                  Remarks" caveat (it's really the raw on_hold value; there's no
                  separate remarks field). */}
              <Table.Column id="customerCode" defaultWidth={120} minWidth={90}>
                Customer Code
                <Table.ColumnResizer />
              </Table.Column>
              <Table.Column id="holdRemarks" defaultWidth={120} minWidth={90}>
                Hold Remarks
                <Table.ColumnResizer />
              </Table.Column>
              <Table.Column id="customerPo" defaultWidth={120} minWidth={90}>
                Customer PO
              </Table.Column>
            </Table.Header>
            <Table.Body>
              {rows.map((row) => (
                <Table.Row key={row.id} id={row.id}>
                  {selectMode ? (
                    <Table.Cell>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(row.id)}
                        onChange={() => toggleRow(row.id)}
                        aria-label={`Select ${row.item_no ?? row.id}`}
                      />
                    </Table.Cell>
                  ) : null}
                  <Table.Cell>
                    <PhotoCell
                      design={row.design}
                      gr={row.gr_color_name}
                      br={row.br_color_name}
                      onOpen={() => row.design && setEnlarged(row)}
                    />
                  </Table.Cell>
                  {/* The rest of the row also opens the lightbox on click, not just the
                      thumbnail ("click the image or the row" — direct feedback,
                      2026-09-10). A plain onClick on these text cells rather than on
                      Table.Row itself: Table.Row's underlying primitive doesn't reliably
                      forward an arbitrary onClick, and doing it per-cell also means the
                      select-mode checkbox cell (not wrapped here) stays unaffected. */}
                  <Table.Cell>
                    <button
                      type="button"
                      className="cursor-pointer text-left disabled:cursor-default"
                      disabled={!row.design}
                      onClick={() => row.design && setEnlarged(row)}
                    >
                      {row.design ?? "—"}
                    </button>
                  </Table.Cell>
                  <Table.Cell>{row.gr_color_name ?? "—"}</Table.Cell>
                  <Table.Cell>{row.br_color_name ?? "—"}</Table.Cell>
                  <Table.Cell>{row.quality ?? "—"}</Table.Cell>
                  <Table.Cell>{row.size ?? "—"}</Table.Cell>
                  <Table.Cell>{row.current_location ?? "—"}</Table.Cell>
                  <Table.Cell>{row.item_no ?? "—"}</Table.Cell>
                  <Table.Cell>{row.serial_no ?? "—"}</Table.Cell>
                  <Table.Cell>{row.customer_no ?? "—"}</Table.Cell>
                  <Table.Cell>{row.on_hold ?? "—"}</Table.Cell>
                  <Table.Cell>{row.customer_po_no ?? "—"}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Content>
        </Table.ResizableContainer>
      </Table>

      {/* Full-size image lightbox — same underlying file as the thumbnail (see
          photoUrl's comment), just shown large. Added per direct feedback, 2026-09-10. */}
      <Modal>
        <Modal.Backdrop isOpen={enlarged !== null} onOpenChange={(open) => !open && setEnlarged(null)}>
          <Modal.Container placement="center">
            <Modal.Dialog className="sm:max-w-2xl">
              {enlarged && (
                <>
                  <Modal.CloseTrigger />
                  <Modal.Header>
                    <Modal.Heading>
                      {enlarged.design} — {enlarged.gr_color_name ?? "—"} / {enlarged.br_color_name ?? "—"}
                    </Modal.Heading>
                  </Modal.Header>
                  <Modal.Body>
                    {enlarged.design ? (
                      // eslint-disable-next-line @next/next/no-img-element -- same
                      // server-only route as the thumbnail, see PhotoCell's comment.
                      <img
                        src={photoUrl(enlarged.design, enlarged.gr_color_name, enlarged.br_color_name)}
                        alt={`${enlarged.design} ${enlarged.gr_color_name ?? ""} ${enlarged.br_color_name ?? ""}`.trim()}
                        className="max-h-[75vh] w-full rounded-lg object-contain"
                      />
                    ) : null}
                  </Modal.Body>
                </>
              )}
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}
