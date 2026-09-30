"use client";

import { useState } from "react";
import Link from "next/link";
import { Accordion } from "@heroui/react";
import type { GuestRef, JourneyStopSummary, JourneySummary } from "@/lib/queries/journeys";
import type { JourneyStatus } from "@/lib/journeyStatus";
import { formatDate, formatTime } from "@/lib/format";
import { EmptyState } from "@/components/shared/EmptyState";
import { DETAIL_PAGE_SIZE, PaginationBar } from "@/components/shared/PaginationBar";
import { JourneyStatusChip } from "@/components/journeys/JourneyStatusChip";

// Ride history for the car detail page, ported from driver-app-new's CarRidesAccordion:
// one collapsible row per journey — route, status, date · driver · guest count — that
// opens to a metrics grid, the passengers, and the stop-by-stop sequence, with a link
// through to the full journey. 10 per page. Its zinc/amber classes are swapped for this
// app's Hero UI tokens; the left rail colour follows the journey's status chip.

const RAIL: Record<JourneyStatus, string> = {
  planned: "border-l-accent",
  ongoing: "border-l-success",
  completed: "border-l-border",
  cancelled: "border-l-danger",
};

function dateLabel(journey: JourneySummary) {
  const from = formatDate(journey.firstPickupAt);
  const to = formatDate(journey.lastDropAt);
  return from === to ? from : `${from} – ${to}`;
}

function endpoints(journey: JourneySummary) {
  const origin = journey.stops.find((s) => s.role === "origin")?.locationName;
  const destination = journey.stops.find((s) => s.role === "destination")?.locationName;
  return { origin: origin ?? "—", destination: destination ?? "—" };
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-surface-secondary/40 p-3.5">
      <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted">{label}</p>
      <p className="truncate text-xs font-semibold text-foreground">{value}</p>
    </div>
  );
}

function PassengerChip({ guest }: { guest: GuestRef }) {
  const initials = guest.name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface-secondary/40 px-3 py-1.5 text-xs font-medium text-foreground">
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[10px] font-extrabold text-accent">
        {initials}
      </span>
      {guest.name}
      {guest.kind === "employee" ? <span className="text-[10px] text-muted">Employee</span> : null}
    </span>
  );
}

function StopChip({ stop, index }: { stop: JourneyStopSummary; index: number }) {
  const who = [...stop.pickups.map((g) => `↑ ${g.name}`), ...stop.drops.map((g) => `↓ ${g.name}`)].join(", ");
  const role = stop.role === "origin" ? "Start" : stop.role === "destination" ? "Destination" : "Stop";
  return (
    <span className="inline-flex items-center gap-2.5 rounded-xl border border-border bg-surface px-3.5 py-1.5">
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-foreground text-[10px] font-extrabold text-background">
        {index + 1}
      </span>
      <span className="flex flex-col leading-tight">
        <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-muted">
          {role}
          <span className="rounded bg-surface-secondary px-1 text-[8px] font-medium tabular-nums">{formatTime(stop.arrivalAt)}</span>
        </span>
        <span className="text-[11px] font-semibold text-foreground">{stop.locationName}</span>
        {who ? <span className="text-[10px] text-muted">{who}</span> : null}
      </span>
    </span>
  );
}

export function CarRidesAccordion({ journeys }: { journeys: JourneySummary[] }) {
  const [page, setPage] = useState(1);

  if (journeys.length === 0) return <EmptyState message="No rides recorded for this vehicle yet." />;

  const paged = journeys.slice((page - 1) * DETAIL_PAGE_SIZE, page * DETAIL_PAGE_SIZE);

  return (
    <div>
      <Accordion className="flex flex-col gap-2">
        {paged.map((journey) => {
          const { origin, destination } = endpoints(journey);
          const pickupCount = journey.stops.reduce((sum, s) => sum + s.pickups.length, 0);
          return (
            <Accordion.Item
              key={journey.id}
              id={journey.id}
              className={`overflow-hidden rounded-xl border border-l-4 border-border bg-surface shadow-sm transition-shadow hover:shadow-md ${RAIL[journey.displayStatus]}`}
            >
              <Accordion.Heading>
                <Accordion.Trigger className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      <span className="text-sm font-semibold text-foreground">{origin}</span>
                      <span aria-hidden className="text-muted">→</span>
                      <span className="text-sm font-semibold text-foreground">{destination}</span>
                      <JourneyStatusChip status={journey.displayStatus} />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                      <span>{dateLabel(journey)}</span>
                      <span aria-hidden>|</span>
                      <span>{journey.driverName ?? "No driver"}</span>
                      <span aria-hidden>|</span>
                      <span>
                        {journey.guestCount} guest{journey.guestCount === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>
                  <Accordion.Indicator className="shrink-0 text-muted" />
                </Accordion.Trigger>
              </Accordion.Heading>

              <Accordion.Panel>
                <Accordion.Body className="px-5 pb-5">
                  <div className="flex flex-col gap-6 border-t border-border pt-5">
                    <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
                      <Metric label="Date" value={dateLabel(journey)} />
                      <Metric label="Driver" value={journey.driverName ?? "—"} />
                      <Metric label="Guests" value={journey.guestCount} />
                      <Metric label="Pickups" value={pickupCount} />
                    </div>

                    {journey.guests.length > 0 ? (
                      <div className="flex flex-col gap-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Passengers</p>
                        <div className="flex flex-wrap gap-2.5">
                          {journey.guests.map((guest, i) => (
                            <PassengerChip key={`${guest.name}-${i}`} guest={guest} />
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {journey.stops.length > 0 ? (
                      <div className="flex flex-col gap-3">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Journey</p>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-3.5 rounded-xl border border-border bg-surface-secondary/30 p-4">
                          {journey.stops.map((stop, idx) => (
                            <div key={stop.sequenceNo} className="flex items-center gap-2">
                              <StopChip stop={stop} index={idx} />
                              {idx < journey.stops.length - 1 ? (
                                <span aria-hidden className="text-muted">
                                  →
                                </span>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="border-t border-border pt-4">
                      <Link href={`/journeys/${journey.id}`} className="text-xs font-semibold text-accent hover:underline">
                        View full journey →
                      </Link>
                    </div>
                  </div>
                </Accordion.Body>
              </Accordion.Panel>
            </Accordion.Item>
          );
        })}
      </Accordion>
      <PaginationBar page={page} pageCount={Math.ceil(journeys.length / DETAIL_PAGE_SIZE)} onPageChange={setPage} />
    </div>
  );
}
