"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import Paper from "@mui/material/Paper";
import useMediaQuery from "@mui/material/useMediaQuery";
import { Button } from "@jaipur-rugs/ui-kit";
import { DEMO_SKETCHERS } from "@/lib/demoData";
import { applyMapAction } from "@/lib/maps/actions";
import type { MapAction, MapCopy, MapOrder, MapsState } from "@/lib/maps/types";

type Role = "manager" | "sketcher" | "admin";

function when(at?: string) {
  return at ? new Date(at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
}

// Serial / Rack / Box / Remarks differ per copy: one line per copy, same order in every column so they line up.
function perCopy(field: keyof MapCopy, headerName: string, width: number, bold = false): GridColDef<MapOrder> {
  return {
    field, headerName, width, sortable: false,
    valueGetter: (_value, row) => row.copies.map((copy) => copy[field]).join(", "),
    renderCell: ({ row }) => (
      <div className="flex flex-col leading-5">
        {row.copies.map((copy) => <span key={copy.serialNo} className={bold ? "font-semibold" : undefined}>{copy[field] || "—"}</span>)}
      </div>
    ),
  };
}

// Quality … Shape describe the map itself, so every copy normally shares them; show each distinct value once.
const detail = (row: MapOrder, field: keyof MapCopy) => [...new Set(row.copies.map((copy) => copy[field]))].join(", ");
function mapDetail(field: keyof MapCopy, headerName: string, width: number): GridColDef<MapOrder> {
  return { field, headerName, width, valueGetter: (_value, row) => detail(row, field) };
}

// More pending orders need this map than there are copies in the library.
const short = (row: MapOrder) => row.required > row.copies.length;

// State lives in the workspace so Home counts and a revisit of this tab show the latest assignments.
export function MapsTab({ state, setState, user }: {
  state: MapsState;
  setState: Dispatch<SetStateAction<MapsState>>;
  user: { role: Role; sketcherName?: string };
}) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null); // order id waiting for "Yes, picked up"
  // On a phone (at the racks) the 20-column grid is unusable, so each order becomes a card.
  const phone = useMediaQuery("(max-width: 767px)");
  const { role } = user;

  async function refresh() {
    setBusy(true);
    setMessage("Reading the Excels… NAV-028 takes about 30 seconds.");
    try {
      const response = await fetch("/api/maps-refresh", { method: "POST" });
      const body = await response.json() as MapsState & { available?: number; error?: string };
      if (!response.ok) throw new Error(body.error ?? "Could not refresh maps.");
      setState({ orders: body.orders, refreshedAt: body.refreshedAt, files: body.files });
      setMessage(`Read ${body.files?.inventory} + ${body.files?.orders} · ${body.available} orders have a map in the library`);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Could not refresh maps.");
    } finally {
      setBusy(false);
    }
  }

  function act(action: MapAction) {
    const current = state.orders.find((order) => order.id === action.id);
    if (!current) return;
    try {
      const local = applyMapAction(current, action, user, new Date().toISOString(), state.orders);
      setState((s) => ({ ...s, orders: s.orders.map((order) => order.id === local.id ? local : order) }));
      setMessage("");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Could not save.");
      return;
    }
    void fetch("/api/maps-action", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(action) })
      .then(async (response) => {
        const body = await response.json() as { order?: MapOrder; error?: string };
        if (!response.ok || !body.order) { setMessage(`${body.error ?? "Could not save."} Reload the page to see the saved state.`); return; }
        setState((s) => ({ ...s, orders: s.orders.map((order) => order.id === body.order!.id ? body.order! : order) }));
      })
      .catch(() => setMessage("Could not reach the server. Your last change may not be saved."));
  }

  const assignControl = (row: MapOrder) => role === "sketcher" || row.pickedUpAt ? <span>{row.assignedTo ?? "—"}</span> : (
    <select
      className="w-full rounded-lg border border-border bg-surface p-1 text-sm"
      value={row.assignedTo ?? ""}
      onChange={(event) => act({ type: "assign", id: row.id, sketcherName: event.target.value })}
    >
      <option value="" disabled>Assign…</option>
      {DEMO_SKETCHERS.map((name) => <option key={name} value={name}>{name}</option>)}
    </select>
  );

  // Picked up is final for the sketcher, so it asks once; the manager and admin can undo a mistake.
  const statusControl = (row: MapOrder) => {
    if (row.pickedUpAt) {
      return (
        <span className="flex items-center gap-2" title={when(row.pickedUpAt)}>
          Picked up
          {role !== "sketcher" ? <button type="button" className="text-xs text-accent" onClick={() => act({ type: "undoPickup", id: row.id })}>Undo</button> : null}
        </span>
      );
    }
    if (row.assignedTo && row.assignedTo === user.sketcherName) {
      return confirming === row.id ? (
        <span className="flex items-center gap-2 text-sm">
          <Button size="sm" onPress={() => { setConfirming(null); act({ type: "pickup", id: row.id }); }}>Yes, picked up / हाँ</Button>
          <button type="button" className="text-xs text-muted" onClick={() => setConfirming(null)}>Cancel</button>
        </span>
      ) : <Button size="sm" onPress={() => setConfirming(row.id)}>Picked up / उठा लिया</Button>;
    }
    return <span title={when(row.assignedAt)}>{row.assignedTo ? "Assigned" : "Not assigned"}</span>;
  };

  // Test.xlsx (MAP Library sheet) columns first, in its order; Req/Ava replace its COUNTIF/VLOOKUP helpers.
  const columns: GridColDef<MapOrder>[] = [
    { field: "productionOrderNo", headerName: "Production Order No", width: 160 },
    { field: "mapItemNo", headerName: "Item No (Map)", width: 120 },
    { field: "available", headerName: "Ava", width: 60, type: "number", valueGetter: (_value, row) => row.copies.length },
    {
      field: "required", headerName: "Req", width: 60, type: "number",
      renderCell: ({ row }) => <span className={short(row) ? "font-bold text-danger" : undefined} title={short(row) ? "More orders need this map than there are copies" : undefined}>{row.required}</span>,
    },
    perCopy("serialNo", "Serial No", 100),
    mapDetail("quality", "Quality", 90),
    mapDetail("design", "Design", 130),
    mapDetail("groundColor", "Ground Color", 110),
    mapDetail("borderColor", "Border Color", 110),
    mapDetail("size", "Size", 80),
    mapDetail("shape", "Shape", 80),
    perCopy("rackNo", "Rack No", 110, true),
    perCopy("boxNo", "Box No", 70, true),
    perCopy("mapRemarks", "Map Remarks", 120),
    { field: "rugItemNo", headerName: "Rug Item No", width: 120 },
    { field: "mapDescription", headerName: "Map Description", width: 280 },
    { field: "followUpPerson", headerName: "Follow Up Person", width: 170 },
    { field: "pendingDays", headerName: "Pending Days", width: 110 },
    { field: "assignedTo", headerName: "Assigned to", width: 190, renderCell: ({ row }) => assignControl(row) },
    {
      field: "pickedUpAt", headerName: "Status", width: 230,
      valueGetter: (_value, row) => row.pickedUpAt ? "Picked up" : row.assignedTo ? "Assigned" : "Not assigned",
      renderCell: ({ row }) => statusControl(row),
    },
  ];

  const empty = role === "sketcher" ? "No maps assigned to you." : "No orders with a map in the library. Admin: press Refresh.";
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        {role === "admin" ? <Button size="sm" isDisabled={busy} onPress={() => void refresh()}>{busy ? "Refreshing…" : "Refresh maps Excel"}</Button> : null}
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
                <p className="text-lg font-semibold">{row.mapItemNo}</p>
                <span className={"text-xs " + (short(row) ? "font-bold text-danger" : "text-muted")}>Ava {row.copies.length} · Req {row.required}</span>
              </div>
              <ul className="mt-2 flex flex-col gap-1">
                {row.copies.map((copy) => (
                  <li key={copy.serialNo} className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg bg-surface-secondary px-3 py-2">
                    <span className="text-base font-bold">Rack {copy.rackNo} · Box {copy.boxNo}</span>
                    <span className="text-xs text-muted">#{copy.serialNo}{copy.mapRemarks ? ` · ${copy.mapRemarks}` : ""}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-sm">{[detail(row, "quality"), detail(row, "design"), detail(row, "size"), detail(row, "shape")].filter(Boolean).join(" · ")}</p>
              <p className="text-xs text-muted">Ground {detail(row, "groundColor")} · Border {detail(row, "borderColor")}</p>
              <p className="text-xs text-muted">{row.productionOrderNo} · {row.rugItemNo} · {row.followUpPerson}</p>
              <div className="mt-3 flex flex-col gap-2">
                {role !== "sketcher" ? assignControl(row) : null}
                {statusControl(row)}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Paper variant="outlined" sx={{ width: "100%" }}>
          <DataGrid
            rows={state.orders}
            columns={columns}
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
