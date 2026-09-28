"use client";

import type { DriverListItem } from "@/lib/queries/drivers";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { DriverActionsMenu } from "./DriverActionsMenu";
import { DriverAvatar } from "./DriverAvatar";
import { DriverStatusChip } from "./DriverStatusChip";
import { RatingBadge } from "./RatingBadge";

// Same columns as driver-app-new's DriversTable (name + photo, phone, status, rating,
// reviews, ⋮ actions), plus the driver code this schema has.
const COLUMNS: DataTableColumn<DriverListItem>[] = [
  {
    id: "full_name",
    label: "Driver",
    isRowHeader: true,
    sortValue: (driver) => driver.full_name.toLowerCase(),
    render: (driver) => (
      <div className="flex items-center gap-3">
        <DriverAvatar fullName={driver.full_name} photoPath={driver.photo_path} size="sm" />
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{driver.full_name}</p>
          <p className="text-xs tracking-wide text-muted tabular-nums">{driver.driver_code}</p>
        </div>
      </div>
    ),
  },
  {
    id: "phone",
    label: "Phone",
    render: (driver) => <span className="text-sm text-muted">{driver.phone}</span>,
  },
  {
    id: "status",
    label: "Status",
    sortValue: (driver) => driver.displayStatus,
    render: (driver) => <DriverStatusChip status={driver.displayStatus} />,
  },
  {
    id: "avgRating",
    label: "Avg rating",
    sortValue: (driver) => driver.avgRating,
    render: (driver) => <RatingBadge rating={driver.avgRating} />,
  },
  {
    id: "reviewCount",
    label: "Reviews",
    sortValue: (driver) => driver.reviewCount,
    render: (driver) => (
      <span className="text-sm text-muted">
        {driver.reviewCount} {driver.reviewCount === 1 ? "review" : "reviews"}
      </span>
    ),
  },
  {
    id: "actions",
    label: "Actions",
    className: "w-14 text-right",
    render: (driver) => (
      <div className="flex justify-end">
        <DriverActionsMenu driver={driver} />
      </div>
    ),
  },
];

export function DriversTable({ drivers }: { drivers: DriverListItem[] }) {
  return (
    <DataTable
      ariaLabel="Drivers"
      columns={COLUMNS}
      rows={drivers}
      getRowId={(driver) => driver.id}
      rowHref={(driver) => `/drivers/${driver.id}`}
      emptyMessage="No drivers yet."
      initialSort={{ column: "full_name", direction: "ascending" }}
    />
  );
}
