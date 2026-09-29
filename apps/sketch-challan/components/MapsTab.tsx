"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import Paper from "@mui/material/Paper";
import useMediaQuery from "@mui/material/useMediaQuery";
import { Button } from "@jaipur-rugs/ui-kit";
import type { MapCopy, MapOrder, MapsState } from "@/lib/maps/types";

function when(at?: string) {
  return at ? new Date(at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
}

// Rack and Box differ per copy: one line per copy, same order in both columns so they line up.
function perCopy(field: keyof MapCopy, headerName: string): GridColDef<MapOrder> {
  return {
    field, headerName, width: 110, sortable: false,
    valueGetter: (_value, row) => row.copies.map((copy) => copy[field]).join(", "),
    renderCell: ({ row }) => row.copies.length ? (
      <div className="flex flex-col leading-5">
        {row.copies.map((copy, i) => <span key={i} className="font-semibold">{copy[field]}</span>)}
      </div>
    ) : <span className="text-muted">Not in library</span>,
  };
}

// The columns the user asked for (2026-09-29): NAV-145 details, then rack and box looked up in NAV-028 LOC-031.
const COLUMNS: GridColDef<MapOrder>[] = [
  { field: "productionOrderNo", headerName: "Prod Order No", width: 160 },
  { field: "quality", headerName: "Quality", width: 120 },
  { field: "design", headerName: "Design", width: 120 },
  { field: "size", headerName: "Size", width: 90 },
  { field: "shape", headerName: "Shape", width: 80 },
  { field: "groundColor", headerName: "Ground Color", width: 110 },
  { field: "borderColor", headerName: "Border Color", width: 110 },
  { field: "mapItemNo", headerName: "Map Item No", width: 120 },
  { field: "action", headerName: "Action to be Taken", width: 140 },
  perCopy("rackNo", "Rack No"),
  perCopy("boxNo", "Box No"),
];

// View only (user, 2026-09-29): Admin and the rack management login look up where each map is; nothing is assigned.
// State lives in the parent so Admin's Home count shows the latest refresh.
export function MapsTab({ state, setState, canRefresh }: {
  state: MapsState;
  setState: Dispatch<SetStateAction<MapsState>>;
  canRefresh: boolean;
}) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  // On a phone (at the racks) the grid is unusable, so each order becomes a card.
  const phone = useMediaQuery("(max-width: 767px)");

  async function refresh() {
    setBusy(true);
    setMessage("Reading the Excels… NAV-028 takes about 30 seconds.");
    try {
      const response = await fetch("/api/maps-refresh", { method: "POST" });
      const body = await response.json() as MapsState & { available?: number; error?: string };
      if (!response.ok) throw new Error(body.error ?? "Could not refresh maps.");
      setState({ orders: body.orders, refreshedAt: body.refreshedAt, files: body.files });
      setMessage(`Read ${body.files?.inventory} + ${body.files?.orders} · ${body.orders.length} Print/Available orders, ${body.available} with a map in the library`);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Could not refresh maps.");
    } finally {
      setBusy(false);
    }
  }

  const empty = "No Print or Available orders yet. Admin: press Refresh.";
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        {canRefresh ? <Button size="sm" isDisabled={busy} onPress={() => void refresh()}>{busy ? "Refreshing…" : "Refresh maps Excel"}</Button> : null}
        <span className="text-sm text-muted">
          {state.refreshedAt ? `Last refreshed ${when(state.refreshedAt)} · ${state.files?.inventory ?? ""}` : "Not refreshed yet."}
        </span>
      </div>
      {message ? <p className="text-sm">{message}</p> : null}
      {phone ? (
        <div className="flex flex-col gap-3">
          {state.orders.length === 0 ? <p className="text-sm text-muted">{empty}</p> : null}
          {state.orders.map((row) => (
            <article key={row.id} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-lg font-semibold">{row.mapItemNo || "No map no."}</p>
                <span className="text-xs text-muted">{row.action}</span>
              </div>
              <ul className="mt-2 flex flex-col gap-1">
                {row.copies.length ? row.copies.map((copy, i) => (
                  <li key={i} className="rounded-lg bg-surface-secondary px-3 py-2 text-base font-bold">Rack {copy.rackNo} · Box {copy.boxNo}</li>
                )) : <li className="text-sm text-muted">Not in library</li>}
              </ul>
              <p className="mt-2 text-sm">{[row.quality, row.design, row.size, row.shape].filter(Boolean).join(" · ")}</p>
              <p className="text-xs text-muted">Ground {row.groundColor} · Border {row.borderColor}</p>
              <p className="text-xs text-muted">{row.productionOrderNo}</p>
            </article>
          ))}
        </div>
      ) : (
        <Paper variant="outlined" sx={{ width: "100%" }}>
          <DataGrid
            rows={state.orders}
            columns={COLUMNS}
            getRowHeight={() => "auto"}
            disableRowSelectionOnClick
            showToolbar
            initialState={{ pagination: { paginationModel: { page: 0, pageSize: 25 } } }}
            pageSizeOptions={[25, 50, 100]}
            localeText={{ noRowsLabel: empty }}
            sx={{ border: 0 }}
          />
        </Paper>
      )}
    </div>
  );
}
