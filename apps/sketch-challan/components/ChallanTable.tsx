"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DataGrid,
  GridCell,
  type GridCellProps,
  type GridColDef,
  type GridRowSelectionModel,
} from "@mui/x-data-grid";
import Paper from "@mui/material/Paper";
import { Button } from "@jaipur-rugs/ui-kit";
import type { SketchChallan } from "@/lib/domain/types";
import { SKETCH_CATEGORIES } from "@/lib/domain/types";
import { DEMO_SKETCHERS } from "@/lib/demoData";
import { pendingChange } from "@/lib/domain/approval";
import { challanStatusLabel, shownChallanDate } from "@/lib/domain/assignments";
import { sortChallans } from "@/lib/domain/challans";
import { exportChallansToExcel } from "@/lib/exportToExcel";
import { showMapFeet } from "@/lib/mapSizeRules";

const PARTS = ["Full sketch", "Border", "Bicha", "Central field", "Length", "Width", "Texture / colouring"];
const PRIORITIES = ["urgent", "high", "normal", "low"];

export const TABLE_COLUMNS = [
  { id: "productionOrderNo", label: "Prod. Order No" },
  { id: "mapNo", label: "Map No" },
  { id: "statusLabel", label: "Status" },
  { id: "challanDate", label: "Challan Date" },
  { id: "draftsman", label: "DraftsMan" },
  { id: "sketchCategory", label: "Sketch Category" },
  { id: "design", label: "Design" },
  { id: "ground", label: "Ground" },
  { id: "border", label: "Border" },
  { id: "matchingCode", label: "Matching Code" },
  { id: "substituteDesign", label: "Substitute Design" },
  { id: "quality", label: "Quality" },
  { id: "shape", label: "Shape" },
  { id: "mapWidthFt", label: "Map Width" },
  { id: "mapLengthFt", label: "Map Length" },
  { id: "areaSqFt", label: "Area" },
  { id: "quantity", label: "Quantity" },
  { id: "dueDate", label: "Due Date" },
  { id: "priority", label: "Priority" },
  { id: "assigned", label: "Assigned to" },
  { id: "approvalStatus", label: "Change approval" },
  { id: "managerRemark1", label: "Manager remark 1" },
  { id: "managerRemark2", label: "Manager remark 2" },
  { id: "sketcherRemark", label: "Sketcher remark" },
] as const;

type ColId = (typeof TABLE_COLUMNS)[number]["id"];

function cell(row: SketchChallan, id: ColId): string {
  if (id === "assigned") return row.tasks.map((task) => `${task.sketcherName} (${task.assignedPart})`).join(", ") || "—";
  if (id === "approvalStatus") return pendingChange(row) ? "Pending admin" : "—";
  if (id === "statusLabel") return challanStatusLabel(row);
  if (id === "challanDate") return shownChallanDate(row);
  if (id === "mapWidthFt" || id === "mapLengthFt") return showMapFeet(row[id], row.mapSizeWhole);
  const value = row[id];
  return value == null || value === "" ? "—" : String(value);
}

const paginationModel = { page: 0, pageSize: 10 };

function renderRowHeaderCell(props: GridCellProps) {
  return (
    <GridCell
      {...props}
      role={props.column.field === "productionOrderNo" ? "rowheader" : "gridcell"}
    />
  );
}

function stop(event: React.SyntheticEvent) {
  event.stopPropagation();
}

function CellSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <select
      className="w-full min-w-0 bg-transparent text-sm"
      value={value}
      onClick={stop}
      onMouseDown={stop}
      onChange={(event) => onChange(event.target.value)}
    >
      {options.includes(value) ? null : <option value={value}>{value || "—"}</option>}
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  );
}

function AssignCell({
  row,
  onAssign,
}: {
  row: SketchChallan;
  onAssign: (sketcherName: string, assignedPart: string) => void;
}) {
  const [sketcherName, setSketcherName] = useState(DEMO_SKETCHERS[0] ?? "Aditi Sharma");
  const [part, setPart] = useState(PARTS[0] ?? "Full sketch");
  // Allotting locks the challan for the manager, so a stray click must not do it: Assign asks once more.
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="flex min-w-[280px] flex-col gap-1 py-1" onClick={stop} onMouseDown={stop}>
      <span className="truncate text-xs text-muted">{cell(row, "assigned")}</span>
      {confirming ? (
        <div className="flex items-center gap-2 text-xs">
          <span className="truncate">Allot {part} to {sketcherName}?</span>
          <button type="button" className="shrink-0 font-semibold text-accent" onClick={() => { setConfirming(false); onAssign(sketcherName, part); }}>Yes, allot</button>
          <button type="button" className="shrink-0 text-muted" onClick={() => setConfirming(false)}>Cancel</button>
        </div>
      ) : (
        <div className="flex gap-1">
          <CellSelect value={sketcherName} options={DEMO_SKETCHERS} onChange={setSketcherName} />
          <CellSelect value={part} options={PARTS} onChange={setPart} />
          <button type="button" className="shrink-0 text-xs text-accent" onClick={() => setConfirming(true)}>Assign</button>
        </div>
      )}
    </div>
  );
}

export function ChallanTable({
  rows,
  onPreview,
  onRefreshExcel,
  onPatch,
  onAssign,
  rowActions,
}: {
  rows: SketchChallan[];
  onPreview: (id: string) => void;
  onRefreshExcel?: () => Promise<string>;
  onPatch?: (id: string, patch: Partial<SketchChallan>, message: string) => void;
  onAssign?: (id: string, sketcherName: string, assignedPart: string) => void;
  /** Buttons for the first column (Approve / Send back); clicks there don't open the challan. */
  rowActions?: (row: SketchChallan) => React.ReactNode;
}) {
  const [visible, setVisible] = useState<Record<string, boolean>>(() => Object.fromEntries(TABLE_COLUMNS.map((col) => [col.id, true])));
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selection, setSelection] = useState<GridRowSelectionModel>({ type: "include", ids: new Set() });
  const [query, setQuery] = useState("");
  const gridRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    // Default order is the design rule: urgent first, then by due date. Header clicks re-sort.
    return sortChallans(rows)
      .filter((row) => !needle || TABLE_COLUMNS.some((col) => cell(row, col.id).toLowerCase().includes(needle)))
      .map((row) => ({ ...row, assigned: cell(row, "assigned"), approvalStatus: cell(row, "approvalStatus"), statusLabel: cell(row, "statusLabel"), challanDate: shownChallanDate(row) }));
  }, [rows, query]);
  const cols = TABLE_COLUMNS.filter((col) => visible[col.id]);
  const columns: GridColDef[] = useMemo(() => [...(rowActions ? [{
    field: "__actions", headerName: "Action", minWidth: 260, sortable: false, filterable: false, disableColumnMenu: true,
    renderCell: (params: { row: SketchChallan }) => (
      <div className="flex h-full flex-wrap items-center gap-1 py-1" onClick={stop} onMouseDown={stop}>{rowActions(params.row)}</div>
    ),
  } satisfies GridColDef] : []), ...TABLE_COLUMNS.map((col): GridColDef => ({
    field: col.id,
    headerName: col.label,
    flex: 1,
    minWidth: col.id === "assigned" ? 320 : col.id === "sketchCategory" ? 220 : col.id.includes("Remark") ? 200 : 140,
    renderCell: !onPatch && !onAssign ? undefined : (params: { row: SketchChallan; value?: unknown }) => {
      const row = params.row as SketchChallan;
      if (col.id === "sketchCategory" && onPatch && row.tasks.length === 0) {
        return (
          <CellSelect
            value={row.sketchCategory}
            options={SKETCH_CATEGORIES}
            onChange={(value) => onPatch(row.id, { sketchCategory: value }, `Category changed to ${value}.`)}
          />
        );
      }
      if (col.id === "priority" && onPatch && row.tasks.length === 0) {
        return (
          <CellSelect
            value={row.priority}
            options={PRIORITIES}
            onChange={(value) => onPatch(row.id, { priority: value as SketchChallan["priority"] }, `Priority set to ${value}.`)}
          />
        );
      }
      if (col.id === "assigned" && onAssign && row.tasks.length === 0) {
        return <AssignCell row={row} onAssign={(name, part) => onAssign(row.id, name, part)} />;
      }
      return params.value == null || params.value === "" ? "—" : String(params.value);
    },
  }))], [onAssign, onPatch, rowActions]);

  // Drag anywhere on the rows to scroll (scrollbars are hidden). A drag doesn't count as a row click.
  const wrap = useRef<HTMLDivElement>(null);
  const dragged = useRef(false);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    let start: { x: number; y: number; left: number; top: number; scroller: HTMLElement } | null = null;
    const down = (event: PointerEvent) => {
      dragged.current = false;
      const target = event.target as HTMLElement;
      if (event.button !== 0 || target.closest("input, select, button, textarea, a, .MuiDataGrid-columnHeaders")) return;
      const scroller = el.querySelector<HTMLElement>(".MuiDataGrid-virtualScroller");
      if (scroller) start = { x: event.clientX, y: event.clientY, left: scroller.scrollLeft, top: scroller.scrollTop, scroller };
    };
    const move = (event: PointerEvent) => {
      if (!start) return;
      const dx = event.clientX - start.x, dy = event.clientY - start.y;
      if (!dragged.current && Math.hypot(dx, dy) < 5) return;
      dragged.current = true;
      el.style.cursor = "grabbing";
      start.scroller.scrollLeft = start.left - dx;
      start.scroller.scrollTop = start.top - dy;
    };
    const up = () => { start = null; el.style.cursor = ""; };
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, []);

  async function copy(): Promise<string> {
    const picked = selection.ids.size ? gridRows.filter((row) => selection.ids.has(row.id)) : gridRows;
    const text = [
      cols.map((col) => col.label).join("\t"),
      ...picked.map((row) => cols.map((col) => cell(row, col.id).replace(/\t|\n/g, " ")).join("\t")),
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Plain-http office server: browsers give no clipboard API there, so use the older copy command.
      const area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.append(area);
      area.select();
      const copied = document.execCommand("copy");
      area.remove();
      if (!copied) throw new Error("The browser blocked copying. Select the rows and press Ctrl+C.");
    }
    return `Copied ${picked.length} row${picked.length === 1 ? "" : "s"}. Paste into Excel.`;
  }

  return (
    <div className="flex flex-col gap-4">
      <input
        type="search"
        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search all columns: PO, design, sketcher, category…"
      />
      <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap">
        <Button size="sm" onPress={() => { setError(""); setNote(""); copy().then(setNote, (err) => setError(err instanceof Error ? err.message : "Could not copy.")); }}>Copy for Excel</Button>
        <Button size="sm" variant="secondary" onPress={() => {
          const picked = selection.ids.size ? gridRows.filter((row) => selection.ids.has(row.id)) : gridRows;
          setError("");
          exportChallansToExcel(picked).catch(() => setError("Could not create the Excel file."));
        }}>Download Excel</Button>
        {onRefreshExcel ? (
          <Button
            size="sm"
            variant="secondary"
            isDisabled={busy}
            onPress={() => {
              void (async () => {
                setBusy(true); setError(""); setNote("");
                try { setNote(await onRefreshExcel()); } catch (err) { setError(err instanceof Error ? err.message : "Could not refresh Excel."); }
                finally { setBusy(false); }
              })();
            }}
          >
            Refresh Excel
          </Button>
        ) : null}
        <Button size="sm" variant="secondary" onPress={() => setShowFilters((open) => !open)}>
          {showFilters ? "Hide columns" : "Show columns"}
        </Button>
        {busy ? <span className="text-sm text-muted">Reading Excel…</span> : null}
        {note && !busy ? <span className="text-sm text-muted">{note}</span> : null}
        {error ? <span className="text-sm text-danger">{error}</span> : null}
      </div>
      <p className="text-xs text-muted">Click a column header to sort; click again to reverse. Drag the rows to scroll. Allotted challan details need admin approval.</p>
      {showFilters ? (
        <div className="flex gap-2 overflow-x-auto whitespace-nowrap pb-1">
          {TABLE_COLUMNS.map((col) => {
            const on = Boolean(visible[col.id]);
            return (
              <button
                key={col.id}
                type="button"
                onClick={() => setVisible((current) => ({ ...current, [col.id]: !on }))}
                className={"shrink-0 rounded-full px-3 py-1 text-xs " + (on ? "bg-accent/10 font-medium text-accent" : "bg-surface-secondary text-muted")}
              >
                {col.label}
              </button>
            );
          })}
        </div>
      ) : null}
      <Paper ref={wrap} sx={{ height: 560, width: "100%" }}>
        <DataGrid
          rows={gridRows}
          columns={columns}
          initialState={{ pagination: { paginationModel } }}
          pageSizeOptions={[10, 25, 50]}
          columnVisibilityModel={visible}
          onColumnVisibilityModelChange={(model) => setVisible(model as Record<string, boolean>)}
          onRowClick={(params) => { if (!dragged.current) onPreview(String(params.id)); }}
          slots={{ cell: renderRowHeaderCell }}
          checkboxSelection
          disableRowSelectionOnClick
          rowSelectionModel={selection}
          onRowSelectionModelChange={setSelection}
          getRowHeight={() => onAssign || rowActions ? 72 : 52}
          getRowClassName={(params) => params.indexRelativeToCurrentPage % 2 === 1 ? "row-even" : "row-odd"}
          sx={{
            border: 0, cursor: "grab", userSelect: "none",
            "& .MuiDataGrid-scrollbar, & .MuiDataGrid-scrollbarFiller": { display: "none" },
            "& .MuiDataGrid-virtualScroller": { scrollbarWidth: "none" },
            "& .MuiDataGrid-row.row-even": { backgroundColor: "#f5f6f8" },
            "& .MuiDataGrid-row:hover": { backgroundColor: "#e9edf2" },
            "& .MuiDataGrid-row.Mui-selected": { backgroundColor: "#e6efff" },
            "& .MuiDataGrid-row.Mui-selected:hover": { backgroundColor: "#dce8fb" },
            "& .MuiDataGrid-iconButtonContainer": { visibility: "visible", width: "auto" },
            "& .MuiDataGrid-columnHeaderTitle": { fontWeight: 700 },
            // Sort cue on every unsorted header (drawn by CSS, so it stays out of copied labels and screen-reader names).
            "& .MuiDataGrid-columnHeader:not(.MuiDataGrid-columnHeader--sorted) .MuiDataGrid-columnHeaderTitle::after": { content: '" ↕"', fontWeight: 400, opacity: 0.5 },
          }}
        />
      </Paper>
    </div>
  );
}
