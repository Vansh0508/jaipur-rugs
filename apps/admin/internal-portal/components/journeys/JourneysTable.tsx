"use client";

import type { JourneySummary } from "@/lib/queries/journeys";
import { formatDate, formatTime } from "@/lib/format";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { JourneyStatusChip } from "./JourneyStatusChip";
import { MarkEndedButton } from "./MarkEndedButton";

// driver-app-new's JourneysTable columns (Date, Car, Driver, Route, Stops, Guests, Status,
// End) on the app's shared Hero UI DataTable.
const STATUS_ORDER = { ongoing: 0, planned: 1, completed: 2, cancelled: 3 } as const;

const COLUMNS: DataTableColumn<JourneySummary>[] = [
  {
    id: "date",
    label: "Date",
    isRowHeader: true,
    sortValue: (j) => j.firstPickupAt,
    render: (j) => (
      <div>
        <p className="text-sm text-foreground tabular-nums">{formatDate(j.firstPickupAt)}</p>
        <p className="text-xs text-muted tabular-nums">{formatTime(j.firstPickupAt)}</p>
      </div>
    ),
  },
  {
    id: "car",
    label: "Car",
    sortValue: (j) => j.plate,
    render: (j) => (
      <div>
        <p className="text-sm font-medium tracking-wide tabular-nums">{j.plate ?? "—"}</p>
        {j.carName ? <p className="truncate text-xs text-muted">{j.carName}</p> : null}
      </div>
    ),
  },
  {
    id: "driver",
    label: "Driver",
    sortValue: (j) => j.driverName,
    render: (j) => <span className="text-sm text-foreground">{j.driverName ?? "—"}</span>,
  },
  {
    id: "route",
    label: "Route",
    render: (j) => {
      const origin = j.stops.find((s) => s.role === "origin")?.locationName ?? "—";
      const destination = j.stops.find((s) => s.role === "destination")?.locationName ?? "—";
      return (
        <span className="block max-w-[240px] truncate text-sm text-muted" title={j.routeSummary}>
          {origin} → {destination}
        </span>
      );
    },
  },
  {
    id: "stops",
    label: "Stops",
    sortValue: (j) => j.stops.length,
    render: (j) => <span className="text-sm text-muted tabular-nums">{j.stops.length}</span>,
  },
  {
    id: "guests",
    label: "Guests",
    sortValue: (j) => j.guestCount,
    render: (j) => <span className="text-sm text-muted tabular-nums">{j.guestCount}</span>,
  },
  {
    id: "status",
    label: "Status",
    sortValue: (j) => STATUS_ORDER[j.displayStatus],
    render: (j) => <JourneyStatusChip status={j.displayStatus} />,
  },
  {
    id: "actions",
    label: "Actions",
    className: "w-32 text-right",
    render: (j) => <div className="flex justify-end">{j.displayStatus === "ongoing" ? <MarkEndedButton journeyId={j.id} size="sm" /> : null}</div>,
  },
];

export function JourneysTable({ journeys }: { journeys: JourneySummary[] }) {
  return (
    <DataTable
      ariaLabel="Journeys"
      columns={COLUMNS}
      rows={journeys}
      getRowId={(j) => j.id}
      rowHref={(j) => `/journeys/${j.id}`}
      emptyMessage="No journeys match your filters."
      initialSort={{ column: "date", direction: "descending" }}
    />
  );
}
