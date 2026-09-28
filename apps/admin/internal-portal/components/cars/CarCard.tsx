import Link from "next/link";
import { Chip } from "@heroui/react";
import type { Enums } from "@jaipur-rugs/supabase-client";
import type { CarListItem } from "@/lib/queries/cars";
import { CarTileIcon } from "@/components/shared/icons";
import { CarActionsMenu } from "./CarActionsMenu";
import { CarStatusChip } from "./CarStatusChip";
import { FUEL_LABEL } from "./fuelLabels";

// Card design ported from driver-app-new's components/features/cars/CarCard.tsx: dark
// icon tile, title, mono plate pill + fuel chip, status chip top-right, a status-tinted
// card, and a one-line status detail ("View active journey →" while on a trip). Its
// zinc/amber/red + dark: classes are swapped for this app's Hero UI tokens so both
// themes come from @heroui/styles. Its ⋮ menu (bottom-right, same place) is
// CarActionsMenu — a client island inside this otherwise server-rendered card.
const CARD_TONE: Record<Enums<"vehicle_status">, string> = {
  vacant: "border-border bg-surface",
  on_trip: "border-warning/40 bg-warning/5",
  maintenance: "border-border bg-surface-secondary/60",
  accidental: "border-danger/40 bg-danger/5",
  inactive: "border-border bg-surface-secondary/60 opacity-70",
};

const STATUS_DETAIL: Partial<Record<Enums<"vehicle_status">, string>> = {
  maintenance: "Out of service — Maintenance",
  accidental: "Out of service — Accidental",
  inactive: "Decommissioned",
};

export function CarCard({ car }: { car: CarListItem }) {
  const detail = STATUS_DETAIL[car.displayStatus];
  const makeModel = `${car.make} ${car.model}`;

  return (
    // Stretched-link card: the whole card opens the car, but the journey link below stays
    // its own separate anchor (a link nested inside a link is invalid HTML).
    <div
      className={`relative flex flex-col rounded-xl border p-4 transition-shadow hover:shadow-md ${CARD_TONE[car.displayStatus]}`}
    >
      <Link href={`/cars/${car.id}`} aria-label={car.name} className="absolute inset-0 rounded-xl" />

      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-foreground text-background shadow-sm">
            <CarTileIcon />
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-foreground" title={car.name}>
              {car.name}
            </p>
            {makeModel !== car.name ? <p className="truncate text-xs text-muted">{makeModel}</p> : null}
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="rounded bg-surface-secondary px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-muted tabular-nums">
                {car.registration_number}
              </span>
              <Chip size="sm" variant="soft">
                <Chip.Label className="text-[10px]">{FUEL_LABEL[car.fuel_type]}</Chip.Label>
              </Chip>
            </div>
          </div>
        </div>
        <div className="mt-0.5 shrink-0">
          <CarStatusChip status={car.displayStatus} />
        </div>
      </div>

      <div className="mt-3 flex min-h-8 items-center justify-between gap-2">
        {car.displayStatus === "on_trip" && car.activeJourneyId ? (
          <Link
            href={`/journeys/${car.activeJourneyId}`}
            className="relative z-10 text-xs font-medium text-warning underline-offset-2 hover:underline"
          >
            View active journey →
          </Link>
        ) : (
          <p className="text-xs text-muted">{detail}</p>
        )}
        <CarActionsMenu car={car} />
      </div>
    </div>
  );
}
