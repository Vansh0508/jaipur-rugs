"use client";

import { Chip } from "@heroui/react";
import type { CarListItem } from "@/lib/queries/cars";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { CarTileIcon } from "@/components/shared/icons";
import { CarActionsMenu } from "./CarActionsMenu";
import { CarStatusChip } from "./CarStatusChip";
import { FUEL_LABEL } from "./fuelLabels";

const COLUMNS: DataTableColumn<CarListItem>[] = [
  {
    id: "name",
    label: "Car",
    isRowHeader: true,
    sortValue: (car) => car.name.toLowerCase(),
    render: (car) => (
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-foreground text-background">
          <CarTileIcon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{car.name}</p>
          {/* Only when it adds information — every seeded car's name is make + model. */}
          {`${car.make} ${car.model}` !== car.name ? (
            <p className="truncate text-xs text-muted">
              {car.make} {car.model}
            </p>
          ) : null}
        </div>
      </div>
    ),
  },
  {
    id: "registration_number",
    label: "Number plate",
    sortValue: (car) => car.registration_number,
    render: (car) => <span className="text-sm font-medium tracking-wide tabular-nums">{car.registration_number}</span>,
  },
  {
    id: "fuel_type",
    label: "Fuel",
    sortValue: (car) => FUEL_LABEL[car.fuel_type],
    render: (car) => (
      <Chip size="sm" variant="soft">
        <Chip.Label>{FUEL_LABEL[car.fuel_type]}</Chip.Label>
      </Chip>
    ),
  },
  {
    id: "status",
    label: "Status",
    sortValue: (car) => car.displayStatus,
    render: (car) => <CarStatusChip status={car.displayStatus} />,
  },
  {
    id: "actions",
    label: "Actions",
    className: "w-14 text-right",
    render: (car) => (
      <div className="flex justify-end">
        <CarActionsMenu car={car} />
      </div>
    ),
  },
];

export function CarsTable({ cars }: { cars: CarListItem[] }) {
  return (
    <DataTable
      ariaLabel="Cars"
      columns={COLUMNS}
      rows={cars}
      getRowId={(car) => car.id}
      rowHref={(car) => `/cars/${car.id}`}
      emptyMessage="No cars yet."
      initialSort={{ column: "name", direction: "ascending" }}
    />
  );
}
