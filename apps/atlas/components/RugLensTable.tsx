"use client";

import { useMemo, useState } from "react";
import type { Key, Selection } from "@heroui/react";
import { Table, Modal, Checkbox } from "@jaipur-rugs/ui-kit";
import { displayDate } from "@/lib/displayDate";
import { copyToClipboard, buildClipboardText, buildClipboardHtml } from "@/lib/clipboardCopy";
import { exportRowsToExcel } from "@/lib/exportToExcel";
import { useLocalPreference } from "@/lib/useLocalPreference";
import { ColumnVisibilityMenu, type ColumnDef } from "./ColumnVisibilityMenu";
import { SelectionActionBar } from "./SelectionActionBar";
import type { RugLensRow } from "@/lib/queries/rugLens";
import type { StageRow } from "@/lib/queries/orders";

// Copy-to-clipboard originally mirrored the Orders tracker's own (much wider) column
// set, per Ayaan's first ask ("same format Atlas tracking already uses") — corrected
// 2026-09-10 per direct follow-up feedback: RugLens's copy output should only carry
// RugLens's OWN columns (Design/GR/BR/Quality/Size/Location/etc.), not Orders-only
// fields like OTN No_, Sales Order No_, Shape, Construction, Std Cubage, Current
// Status, Stage, Days in Stage, or the three date columns. "Same format" meant the
// paste-into-Excel-or-email MECHANICS (tab-separated + real HTML table — see
// lib/clipboardCopy.ts), not literally the same column list.
//
// Reuses exportCells (below, already RugLens-specific, built for the Excel-export
// feature added the same day) as the one column definition for BOTH Copy and Export,
// rather than keeping two separate lists that could quietly drift apart.
function clipboardRows(rows: RugLensRow[], stageNameById: Map<string, string>): { headers: string[]; cells: (string | number | null)[][] } {
  const objects = rows.map((r) => exportCells(r, stageNameById));
  const headers = Object.keys(objects[0] ?? {});
  return { headers, cells: objects.map((obj) => headers.map((h) => obj[h as keyof typeof obj] ?? null)) };
}

function exportCells(o: RugLensRow, stageNameById: Map<string, string>) {
  return {
    "Item No.": o.item_no,
    Design: o.design,
    "GR Color": o.gr_color_name,
    "BR Color": o.br_color_name,
    Quality: o.quality,
    Size: o.size,
    Location: o.current_location,
    "Serial No.": o.serial_no,
    Stage: o.stage_id ? stageNameById.get(o.stage_id) ?? "" : "",
    "Customer Code": o.customer_no,
    "Hold Remarks": o.on_hold,
    "Customer PO": o.customer_po_no,
  };
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

const ALL_COLUMNS: (ColumnDef & { defaultWidth: number; minWidth: number })[] = [
  { id: "photo", label: "Photo", defaultWidth: 90, minWidth: 80 },
  { id: "design", label: "Design", defaultWidth: 130, minWidth: 90 },
  { id: "grColor", label: "GR Color", defaultWidth: 120, minWidth: 90 },
  { id: "brColor", label: "BR Color", defaultWidth: 120, minWidth: 90 },
  { id: "quality", label: "Quality", defaultWidth: 110, minWidth: 80 },
  { id: "size", label: "Size", defaultWidth: 100, minWidth: 70 },
  { id: "location", label: "Location", defaultWidth: 180, minWidth: 130 },
  { id: "itemNo", label: "Item No.", defaultWidth: 130, minWidth: 100 },
  { id: "serialNo", label: "Serial No.", defaultWidth: 130, minWidth: 100 },
  // Added per direct feedback, 2026-09-10 — see the clipboard headers' comment above
  // for why these three specifically, and the "Hold Remarks" caveat (it's really the
  // raw on_hold value; there's no separate remarks field).
  { id: "customerCode", label: "Customer Code", defaultWidth: 120, minWidth: 90 },
  { id: "holdRemarks", label: "Hold Remarks", defaultWidth: 120, minWidth: 90 },
  { id: "customerPo", label: "Customer PO", defaultWidth: 120, minWidth: 90 },
];

export function RugLensTable({ rows, stages }: { rows: RugLensRow[]; stages: StageRow[] }) {
  const stageNameById = useMemo(() => new Map(stages.map((s) => [s.id, s.display_name])), [stages]);

  const [selectedKeys, setSelectedKeys] = useState<Selection>(new Set<Key>());
  const [hiddenColumns, setHiddenColumns] = useLocalPreference<string[]>("atlas:rugLens:columns", []);
  const hidden = useMemo(() => new Set(hiddenColumns), [hiddenColumns]);
  const visibleColumns = useMemo(() => ALL_COLUMNS.filter((c) => !hidden.has(c.id)), [hidden]);
  // The row currently shown full-size in the lightbox — null when closed. Clicking the
  // row itself (not just the thumbnail) also opens it, per direct feedback, 2026-09-10.
  const [enlarged, setEnlarged] = useState<RugLensRow | null>(null);

  const selectedCount = selectedKeys === "all" ? rows.length : selectedKeys.size;
  function selectedRows(): RugLensRow[] {
    if (selectedKeys === "all") return rows;
    return rows.filter((r) => (selectedKeys as Set<Key>).has(r.id));
  }

  async function handleCopySelected(): Promise<boolean> {
    const selected = selectedRows();
    if (!selected.length) return false;
    const { headers, cells } = clipboardRows(selected, stageNameById);
    return copyToClipboard(buildClipboardText(headers, cells), buildClipboardHtml(headers, cells));
  }

  function handleExportSelected() {
    const selected = selectedRows();
    if (!selected.length) return;
    exportRowsToExcel(
      selected.map((r) => exportCells(r, stageNameById)),
      "RugLens",
      `atlas-ruglens-selected-${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  }

  if (!rows.length) {
    return <p className="rounded-xl border-2 border-border p-8 text-center text-sm text-muted">No open stock matches these filters.</p>;
  }

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex shrink-0 items-center gap-3">
        <ColumnVisibilityMenu columns={ALL_COLUMNS} hidden={hidden} onChange={(next) => setHiddenColumns([...next])} />
      </div>

      <div className="relative h-full min-h-0 flex-1">
        <Table variant="secondary" className="h-full min-h-0 flex-1">
          <Table.ResizableContainer className="h-full overflow-y-auto overflow-x-auto rounded-xl border-2 border-border">
            <Table.Content
              aria-label="Open stock / samples"
              selectionMode="multiple"
              selectionBehavior="toggle"
              selectedKeys={selectedKeys}
              onSelectionChange={setSelectedKeys}
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
                  <Table.Column key={col.id} id={col.id} isRowHeader={i === 0} defaultWidth={col.defaultWidth} minWidth={col.minWidth}>
                    {col.label}
                    {i < visibleColumns.length - 1 ? <Table.ColumnResizer /> : null}
                  </Table.Column>
                ))}
              </Table.Header>
              <Table.Body>
                {rows.map((row) => {
                  const cellsById: Record<string, React.ReactNode> = {
                    photo: <PhotoCell design={row.design} gr={row.gr_color_name} br={row.br_color_name} onOpen={() => row.design && setEnlarged(row)} />,
                    // The rest of the row also opens the lightbox on click, not just the
                    // thumbnail ("click the image or the row" — direct feedback,
                    // 2026-09-10). A plain onClick on this text cell rather than on
                    // Table.Row itself: Table.Row's underlying primitive doesn't
                    // reliably forward an arbitrary onClick, and doing it per-cell also
                    // means the selection checkbox cell stays unaffected.
                    design: (
                      <button type="button" className="cursor-pointer text-left disabled:cursor-default" disabled={!row.design} onClick={() => row.design && setEnlarged(row)}>
                        {row.design ?? "—"}
                      </button>
                    ),
                    grColor: row.gr_color_name ?? "—",
                    brColor: row.br_color_name ?? "—",
                    quality: row.quality ?? "—",
                    size: row.size ?? "—",
                    location: row.current_location ?? "—",
                    itemNo: row.item_no ?? "—",
                    serialNo: row.serial_no ?? "—",
                    customerCode: row.customer_no ?? "—",
                    holdRemarks: row.on_hold ?? "—",
                    customerPo: row.customer_po_no ?? "—",
                  };
                  return (
                    <Table.Row key={row.id} id={row.id}>
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
