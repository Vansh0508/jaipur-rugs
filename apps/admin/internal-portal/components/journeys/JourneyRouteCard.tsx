"use client";

import Link from "next/link";
import { Tooltip } from "@heroui/react";
import type { JourneyStopSummary, JourneySummary } from "@/lib/queries/journeys";
import { formatDate, formatTime } from "@/lib/format";
import { CarTileIcon } from "@/components/shared/icons";
import { JourneyStatusChip } from "./JourneyStatusChip";
import { MarkEndedButton } from "./MarkEndedButton";

// driver-app-new's JourneyCard, ported: dark car tile + driver name, date · plate pill,
// status chip, then a vertical dashed route timeline — Start point, an "N stops" count
// whose tooltip lists each intermediate stop's time and who's picked up/dropped there,
// and Destination — and a "Mark ended" footer while the journey is in progress. Its
// zinc/emerald/amber classes are swapped for this app's Hero UI tokens.

function StopsTooltip({ stops }: { stops: JourneyStopSummary[] }) {
  return (
    <div className="relative z-20 flex items-center gap-3.5">
      <span className="ml-1.5 size-2 shrink-0 rounded-full bg-border ring-4 ring-surface" />
      <Tooltip delay={150} closeDelay={0}>
        <Tooltip.Trigger>
          <span className="cursor-default select-none text-xs font-medium text-muted underline decoration-dashed underline-offset-2">
            {stops.length} stop{stops.length !== 1 ? "s" : ""}
          </span>
        </Tooltip.Trigger>
        <Tooltip.Content showArrow placement="top" className="overflow-hidden rounded-xl border border-border bg-surface p-2 shadow-lg">
          <div className="flex min-w-[240px] max-w-[320px] flex-col gap-3 p-1">
            {stops.map((stop) => {
              const total = stop.pickups.length + stop.drops.length;
              return (
                <div key={stop.sequenceNo} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="size-1.5 shrink-0 rounded-full bg-accent" />
                      <p className="truncate text-xs font-semibold text-foreground">{stop.locationName}</p>
                    </div>
                    <span className="shrink-0 rounded bg-surface-secondary px-1 text-[10px] font-medium text-muted tabular-nums">
                      {formatTime(stop.arrivalAt)}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-2.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {stop.pickups.length > 0 ? (
                        <span className="inline-flex items-center rounded-full border border-success/20 bg-success/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-success">
                          {stop.pickups.length} Picked up
                        </span>
                      ) : null}
                      {stop.drops.length > 0 ? (
                        <span className="inline-flex items-center rounded-full border border-warning/20 bg-warning/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-warning">
                          {stop.drops.length} Dropped off
                        </span>
                      ) : null}
                      <span className="text-[10px] text-muted">
                        {total} passenger{total !== 1 ? "s" : ""}
                      </span>
                    </div>
                    {total > 0 ? (
                      <div className="border-t border-border pt-1.5 text-[10px] leading-normal text-muted">
                        {[...stop.pickups.map((g) => `↑ ${g.name}`), ...stop.drops.map((g) => `↓ ${g.name}`)].join(", ")}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </Tooltip.Content>
      </Tooltip>
    </div>
  );
}

export function JourneyRouteCard({ journey }: { journey: JourneySummary }) {
  const origin = journey.stops.find((s) => s.role === "origin");
  const destination = journey.stops.find((s) => s.role === "destination");
  const intermediate = journey.stops.filter((s) => s.role === "stop");

  return (
    <div className="flex flex-col rounded-xl border border-border bg-surface shadow-sm transition-shadow duration-200 hover:shadow-md">
      <Link href={`/journeys/${journey.id}`} className="block">
        <div className="flex items-start justify-between gap-2 p-4 pb-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-foreground text-background shadow-sm">
              <CarTileIcon />
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-foreground">{journey.driverName ?? "No driver"}</p>
              <p className="truncate text-xs text-muted">
                {formatDate(journey.firstPickupAt)} &middot;{" "}
                <span className="rounded bg-surface-secondary px-1.5 py-0.5 text-[10px] font-medium tracking-wide tabular-nums">
                  {journey.plate ?? "No car"}
                </span>
              </p>
            </div>
          </div>
          <JourneyStatusChip status={journey.displayStatus} />
        </div>

        <div className="relative flex flex-col gap-3.5 overflow-visible border-t border-border bg-surface-secondary/30 px-4 py-4">
          <div className="pointer-events-none absolute bottom-[28px] left-[23px] top-[28px] w-0.5 border-l-2 border-dashed border-border" />

          <div className="relative z-10 flex items-start gap-3.5">
            <span className="mt-1 size-3.5 shrink-0 rounded-full border-2 border-muted bg-surface" />
            <div className="min-w-0 flex-1">
              <p className="mb-1 text-[10px] font-semibold uppercase leading-none tracking-wider text-muted">Start point</p>
              <p className="truncate text-xs font-semibold text-foreground">{origin?.locationName ?? "—"}</p>
            </div>
          </div>

          {intermediate.length > 0 ? <StopsTooltip stops={intermediate} /> : null}

          <div className="relative z-10 flex items-start gap-3.5">
            <span className="mt-1 size-3.5 shrink-0 rounded-full border-2 border-accent bg-surface" />
            <div className="min-w-0 flex-1">
              <p className="mb-1 text-[10px] font-semibold uppercase leading-none tracking-wider text-muted">Destination</p>
              <p className="truncate text-xs font-semibold text-foreground">{destination?.locationName ?? "—"}</p>
            </div>
          </div>
        </div>
      </Link>

      {journey.displayStatus === "ongoing" ? (
        <div className="mt-auto flex items-center gap-2 border-t border-border px-4 py-3">
          <MarkEndedButton journeyId={journey.id} size="sm" fullWidth />
        </div>
      ) : null}
    </div>
  );
}
