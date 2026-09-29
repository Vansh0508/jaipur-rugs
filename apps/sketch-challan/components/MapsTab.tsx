"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import Paper from "@mui/material/Paper";
import useMediaQuery from "@mui/material/useMediaQuery";
import { Button } from "@jaipur-rugs/ui-kit";
import { applyMapAction, mapsView, type MapRow, type MapsRole } from "@/lib/maps/choose";
import type { MapAction, MapCopy, MapsState } from "@/lib/maps/types";

type Tab = "inRack" | "notAvailable" | "chosen";
const TABS: [Tab, string][] = [["inRack", "In rack"], ["notAvailable", "Not available"], ["chosen", "Chosen"]];
const LINE = "flex h-7 items-center"; // one line per copy, the same height in every column so they line up

function when(at?: string) {
  return at ? new Date(at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
}

// The copies a row shows: what's left in the rack, or the one ticked for it.
const copiesOf = (row: MapRow): MapCopy[] => row.pick ? [row.pick] : row.left;

// Maps screen (29 Sep meeting): Admin and rack management. Rack management ticks the copy it pulls for an order; that
// copy moves to Chosen and leaves the other orders of the same map. Admin unticks a mistake and can show the hidden
// columns (Action to be Taken, Quality, rug Item No). State lives in the parent so a revisit shows the latest ticks.
export function MapsTab({ state, setState, canRefresh, role }: {
  state: MapsState;
  setState: Dispatch<SetStateAction<MapsState>>;
  canRefresh: boolean;
  role: MapsRole;
}) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>("inRack");
  // On a phone (at the racks) the grid is unusable, so each order becomes a card.
  const phone = useMediaQuery("(max-width: 767px)");
  const view = useMemo(() => mapsView(state), [state]);
  const rows = view[tab];

  async function refresh() {
    setBusy(true);
    setMessage("Reading the NAV reports…");
    try {
      const response = await fetch("/api/maps-refresh", { method: "POST" });
      const body = await response.json() as MapsState & { available?: number; error?: string };
      if (!response.ok) throw new Error(body.error ?? "Could not refresh maps.");
      setState({ orders: body.orders, chosen: body.chosen, refreshedAt: body.refreshedAt, files: body.files });
      setMessage(`Read ${body.files?.inventory} + ${body.files?.orders} · ${body.orders.length} Print/Available orders, ${body.available} with a map in the library`);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Could not refresh maps.");
    } finally {
      setBusy(false);
    }
  }

  function act(action: MapAction) {
    try {
      setState((current) => applyMapAction(current, action, role, new Date().toISOString()));
      setMessage("");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Could not save.");
      return;
    }
    void fetch("/api/maps-action", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(action) })
      .then(async (response) => {
        const body = await response.json() as { chosen?: MapsState["chosen"]; error?: string };
        if (!response.ok || !body.chosen) { setMessage(`${body.error ?? "Could not save."} Reload the page to see the saved state.`); return; }
        setState((current) => ({ ...current, chosen: body.chosen }));
      })
      .catch(() => setMessage("Could not reach the server. Your last tick may not be saved."));
  }

  const tick = (row: MapRow, copy: MapCopy) => (
    <button type="button" className="rounded-md bg-accent px-2 py-0.5 text-xs font-semibold text-white" onClick={() => act({ type: "choose", orderId: row.id, serialNo: copy.serialNo })}>Tick</button>
  );

  const perCopy = (field: "rackNo" | "boxNo", headerName: string): GridColDef<MapRow> => ({
    field, headerName, width: 110, sortable: false, cellClassName: "col-rack", headerClassName: "col-rack",
    valueGetter: (_value, row) => copiesOf(row).map((copy) => copy[field]).join(", "),
    renderCell: ({ row }) => copiesOf(row).length ? (
      <div className="flex flex-col">{copiesOf(row).map((copy) => <span key={copy.serialNo} className={LINE + " font-bold"}>{copy[field]}</span>)}</div>
    ) : <span className="text-muted">{row.copies.length ? "All ticked" : "Not in library"}</span>,
  });

  const columns: GridColDef<MapRow>[] = [
    { field: "productionOrderNo", headerName: "Prod Order No", width: 170, cellClassName: "col-po", headerClassName: "col-po" },
    {
      field: "mapItemNo", headerName: "Map No", width: 150, cellClassName: "col-map", headerClassName: "col-map",
      renderCell: ({ row }) => (
        <div className="flex flex-col leading-5">
          <span>{row.mapItemNo || "—"}</span>
          {tab !== "chosen" ? <span className="text-[11px] font-normal text-muted">{row.needed} needed · {row.left.length} in rack</span> : null}
        </div>
      ),
    },
    { field: "design", headerName: "Design", width: 140 },
    { field: "size", headerName: "Size", width: 90 },
    { field: "shape", headerName: "Shape", width: 80 },
    { field: "groundColor", headerName: "Ground", width: 100 },
    { field: "borderColor", headerName: "Border", width: 100 },
    perCopy("rackNo", "Rack No"),
    perCopy("boxNo", "Box No"),
    ...(tab === "inRack" ? [{
      field: "tick", headerName: "Pick", width: 80, sortable: false,
      renderCell: ({ row }) => <div className="flex flex-col">{row.left.map((copy) => <span key={copy.serialNo} className={LINE}>{tick(row, copy)}</span>)}</div>,
    } satisfies GridColDef<MapRow>] : []),
    ...(tab === "chosen" ? [{
      field: "pickedAt", headerName: "Ticked", width: 190, sortable: false,
      valueGetter: (_value: unknown, row: MapRow) => row.pick?.at ?? "",
      renderCell: ({ row }: { row: MapRow }) => (
        <span className="flex items-center gap-2">
          {when(row.pick?.at)}
          {role === "admin" ? <button type="button" className="rounded-md bg-surface-secondary px-2 py-0.5 text-xs font-semibold" onClick={() => act({ type: "unchoose", orderId: row.id })}>Untick</button> : null}
        </span>
      ),
    } satisfies GridColDef<MapRow>] : []),
    // Kept off the main view; admins can show them from the Columns button.
    ...(role === "admin" ? [
      { field: "action", headerName: "Action to be Taken", width: 150 },
      { field: "quality", headerName: "Quality", width: 120 },
      { field: "rugItemNo", headerName: "Rug Item No", width: 130 },
    ] satisfies GridColDef<MapRow>[] : []),
  ];

  const empty = tab === "inRack" ? "No order has a copy waiting in the rack." : tab === "notAvailable" ? "Every order has a copy in the rack." : "No copy ticked yet.";
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        {canRefresh ? <Button size="sm" isDisabled={busy} onPress={() => void refresh()}>{busy ? "Refreshing…" : "Refresh maps Excel"}</Button> : null}
        <span className="text-sm text-muted">
          {state.refreshedAt ? `Last refreshed ${when(state.refreshedAt)} · ${state.files?.inventory ?? ""}` : "Not refreshed yet."}
        </span>
      </div>
      {message ? <p className="text-sm">{message}</p> : null}
      <div className="flex flex-col gap-3 md:flex-row">
        <nav className="flex shrink-0 gap-2 overflow-x-auto md:w-44 md:flex-col">
          {TABS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={"shrink-0 rounded-lg px-3 py-2 text-left text-sm " + (tab === id ? "bg-accent/10 font-semibold text-accent" : "text-foreground hover:bg-surface-secondary")}
            >
              {label} ({view[id].length})
            </button>
          ))}
        </nav>
        <div className="min-w-0 flex-1">
          {phone ? (
            <div className="flex flex-col gap-3">
              {rows.length === 0 ? <p className="text-sm text-muted">{empty}</p> : null}
              {rows.map((row) => (
                <article key={row.id} className="rounded-xl border border-border bg-surface p-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-lg font-bold text-[#6d28d9]">{row.mapItemNo || "No map no."}</p>
                    <span className="text-xs font-bold text-[#1d4ed8]">{row.productionOrderNo}</span>
                  </div>
                  {tab !== "chosen" ? <p className="text-xs text-muted">{row.needed} needed · {row.left.length} in rack</p> : null}
                  <ul className="mt-2 flex flex-col gap-1">
                    {copiesOf(row).length ? copiesOf(row).map((copy) => (
                      <li key={copy.serialNo} className="flex items-center justify-between gap-2 rounded-lg bg-[#fff7e6] px-3 py-2 text-base font-bold">
                        <span>Rack {copy.rackNo} · Box {copy.boxNo}</span>
                        {tab === "inRack" ? tick(row, copy) : null}
                      </li>
                    )) : <li className="text-sm text-muted">{row.copies.length ? "All copies ticked for other orders" : "Not in library"}</li>}
                  </ul>
                  <p className="mt-2 text-sm">{[row.design, row.size, row.shape].filter(Boolean).join(" · ")}</p>
                  <p className="text-xs text-muted">Ground {row.groundColor} · Border {row.borderColor}</p>
                  {tab === "chosen" ? (
                    <p className="mt-2 flex items-center gap-2 text-xs text-muted">Ticked {when(row.pick?.at)}
                      {role === "admin" ? <button type="button" className="rounded-md bg-surface-secondary px-2 py-0.5 font-semibold text-foreground" onClick={() => act({ type: "unchoose", orderId: row.id })}>Untick</button> : null}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <Paper variant="outlined" sx={{ width: "100%" }}>
              <DataGrid
                key={tab}
                rows={rows}
                columns={columns}
                getRowHeight={() => "auto"}
                disableRowSelectionOnClick
                showToolbar
                showCellVerticalBorder
                showColumnVerticalBorder
                initialState={{
                  pagination: { paginationModel: { page: 0, pageSize: 25 } },
                  columns: { columnVisibilityModel: { action: false, quality: false, rugItemNo: false } },
                }}
                pageSizeOptions={[25, 50, 100]}
                localeText={{ noRowsLabel: empty }}
                sx={{
                  border: 0,
                  "& .MuiDataGrid-columnHeaderTitle": { fontWeight: 700 },
                  "& .MuiDataGrid-cell": { py: 0.75, borderBottom: "1px solid #d9dde3" },
                  "& .MuiDataGrid-columnHeader": { backgroundColor: "#f1f3f6" },
                  "& .col-po": { color: "#1d4ed8", fontWeight: 700 },
                  "& .col-map": { color: "#6d28d9", fontWeight: 700 },
                  "& .MuiDataGrid-columnHeader.col-po, & .MuiDataGrid-columnHeader.col-map": { backgroundColor: "#e8eefc" },
                  "& .MuiDataGrid-cell.col-rack": { backgroundColor: "#fff7e6" },
                  "& .MuiDataGrid-columnHeader.col-rack": { backgroundColor: "#fdebc8" },
                }}
              />
            </Paper>
          )}
        </div>
      </div>
    </div>
  );
}
