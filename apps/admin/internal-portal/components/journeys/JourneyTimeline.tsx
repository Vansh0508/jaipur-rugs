"use client";

import type { ReactNode } from "react";
import { Card, Disclosure, DisclosureGroup, Separator } from "@heroui/react";
import { StarRating, Table } from "@jaipur-rugs/ui-kit";
import type { GuestRef, JourneyDetail, JourneyStopSummary } from "@/lib/queries/journeys";
import type { FeedbackRow } from "@/lib/queries/feedback";
import { formatDate, formatTime } from "@/lib/format";

// The journey record page's body, ported from driver-app-new's JourneyTimeline: a
// passenger list and (once the trip is done) the guests' feedback on the left, and the
// route as a vertical timeline on the right — start point, each stop, destination — where
// every stop opens to who is picked up / dropped off there. Its zinc/emerald/amber classes
// are swapped for this app's Hero UI tokens. The layout fills the page width; only the
// route column is fixed-width.

function LocationPin({ className }: { className?: string }) {
  return (
    <svg width="16" height="20" viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
      <circle cx="12" cy="9" r="2.5" fill="white" />
    </svg>
  );
}

function passengerLabel(g: GuestRef) {
  return g.kind === "employee" ? `${g.name} (employee ${g.employeeCode})` : g.name;
}

function GuestChip({ guest }: { guest: GuestRef }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-secondary/40 px-2.5 py-1 text-xs font-semibold text-foreground">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-muted" aria-hidden>
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
      {passengerLabel(guest)}
    </span>
  );
}

const PICKED_UP_PILL =
  "inline-flex items-center gap-1 rounded-full border border-success/20 bg-success/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-success";
const DROPPED_OFF_PILL =
  "inline-flex items-center gap-1 rounded-full border border-warning/20 bg-warning/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-warning";

/** Pickup / drop breakdown for one stop — collapsed to the counts, opens to the names. */
function StopAccordion({ stop }: { stop: JourneyStopSummary }) {
  const total = stop.pickups.length + stop.drops.length;
  return (
    <Disclosure className="overflow-hidden rounded-xl border border-border bg-surface transition-all duration-200 data-[expanded=true]:shadow-sm">
      <Disclosure.Heading>
        <Disclosure.Trigger className="flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors hover:bg-surface-secondary/60 focus:outline-none">
          <div className="flex flex-wrap items-center gap-2">
            {stop.pickups.length > 0 ? <span className={PICKED_UP_PILL}>{stop.pickups.length} Picked up</span> : null}
            {stop.drops.length > 0 ? <span className={DROPPED_OFF_PILL}>{stop.drops.length} Dropped off</span> : null}
            <span className="text-[11px] text-muted">
              {total} passenger{total !== 1 ? "s" : ""}
            </span>
          </div>
          <Disclosure.Indicator className="ml-2 shrink-0 text-muted transition-transform duration-200" />
        </Disclosure.Trigger>
      </Disclosure.Heading>
      <Disclosure.Content>
        <Disclosure.Body className="space-y-3 border-t border-border bg-surface-secondary/30 px-4 pb-4 pt-0">
          {stop.pickups.length > 0 ? (
            <div className="pt-3">
              <span className={PICKED_UP_PILL}>Picked up</span>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {stop.pickups.map((g, i) => (
                  <GuestChip key={`${g.name}-${i}`} guest={g} />
                ))}
              </div>
            </div>
          ) : null}
          {stop.drops.length > 0 ? (
            <div className={stop.pickups.length > 0 ? "" : "pt-3"}>
              <span className={DROPPED_OFF_PILL}>Dropped off</span>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {stop.drops.map((g, i) => (
                  <GuestChip key={`${g.name}-${i}`} guest={g} />
                ))}
              </div>
            </div>
          ) : null}
        </Disclosure.Body>
      </Disclosure.Content>
    </Disclosure>
  );
}

/** One node of the route: origin (green pin), an intermediate stop (accent pin) or destination (red pin). */
function RouteNode({ stop, isLast }: { stop: JourneyStopSummary; isLast: boolean }) {
  const isEndpoint = stop.role !== "stop";
  const pinTone = stop.role === "origin" ? "text-success" : stop.role === "destination" ? "text-danger" : "text-accent";
  const hasPeople = stop.pickups.length + stop.drops.length > 0;
  return (
    <div className="flex items-stretch gap-4">
      <div className="flex flex-col items-center">
        <div className="flex size-8 shrink-0 items-center justify-center">
          <LocationPin className={pinTone} />
        </div>
        {!isLast ? <div className="w-[2px] flex-1 border-l border-dashed border-border" /> : null}
      </div>
      <div className="min-w-0 flex-1 pb-4 pt-1">
        {isEndpoint ? (
          <>
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                {stop.role === "origin" ? "Start point" : "Destination"}
              </p>
              <span className="shrink-0 rounded bg-surface-secondary px-1.5 py-0.5 text-xs font-medium tabular-nums text-muted">
                {formatTime(stop.arrivalAt)}
              </span>
            </div>
            <p className="mb-2 mt-0.5 text-sm font-semibold text-foreground">{stop.locationName}</p>
          </>
        ) : (
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <p className="truncate text-sm font-semibold text-foreground">{stop.locationName}</p>
            <span className="shrink-0 rounded bg-surface-secondary px-1.5 py-0.5 text-xs font-medium tabular-nums text-muted">
              {formatTime(stop.arrivalAt)}
            </span>
          </div>
        )}
        {hasPeople ? <StopAccordion stop={stop} /> : null}
      </div>
    </div>
  );
}

function FeedbackPanel({ feedback }: { feedback: FeedbackRow[] }) {
  if (feedback.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface-secondary/30 py-8 text-center">
        <p className="text-xs text-muted">No feedback submitted yet.</p>
      </div>
    );
  }
  return (
    <DisclosureGroup className="space-y-3">
      {feedback.map((f) => (
        <Disclosure
          key={f.id}
          className="overflow-hidden rounded-xl border border-border bg-surface transition-all duration-200 data-[expanded=true]:shadow-sm"
        >
          <Disclosure.Heading>
            <Disclosure.Trigger className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-surface-secondary/50 focus:outline-none">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-secondary text-xs font-bold uppercase text-muted">
                  {f.reviewerName.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-foreground">{f.reviewerName}</p>
                  <p className="mt-0.5 text-[10px] text-muted">{formatDate(f.createdAt)}</p>
                </div>
              </div>
              <div className="ml-2 flex shrink-0 items-center gap-3">
                <StarRating value={f.rating} isReadOnly size={16} />
                <Disclosure.Indicator className="text-muted transition-transform duration-200" />
              </div>
            </Disclosure.Trigger>
          </Disclosure.Heading>
          <Disclosure.Content>
            <Disclosure.Body className="border-t border-border bg-surface-secondary/30 p-4 pt-0">
              <div className="pt-3 text-xs leading-relaxed">
                {f.description ? (
                  <p className="rounded-lg border border-border bg-surface p-3 italic text-foreground">&ldquo;{f.description}&rdquo;</p>
                ) : (
                  <p className="italic text-muted">No comments provided by this passenger.</p>
                )}
                <div className="mt-3 flex items-center justify-between text-[10px] text-muted">
                  <span>{f.reviewerKind === "employee" ? "Employee" : "Verified passenger"}</span>
                  <span>Feedback ID: {f.id.slice(0, 8)}</span>
                </div>
              </div>
            </Disclosure.Body>
          </Disclosure.Content>
        </Disclosure>
      ))}
    </DisclosureGroup>
  );
}

function SectionCard({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <Card className="w-full border border-border bg-surface shadow-sm">
      <Card.Header className="flex flex-col items-start px-6 pb-3 pt-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">{eyebrow}</p>
        <h2 className="mt-0.5 text-lg font-bold text-foreground">{title}</h2>
      </Card.Header>
      <Separator />
      <Card.Content className="p-6">{children}</Card.Content>
    </Card>
  );
}

export function JourneyTimeline({ journey, feedback }: { journey: JourneyDetail; feedback: FeedbackRow[] }) {
  return (
    <div className="flex w-full flex-col items-start gap-6 lg:flex-row">
      {/* Left: passengers, then feedback once the trip is done */}
      <div className="w-full flex-1 space-y-6">
        <SectionCard eyebrow="Passenger list" title={`Guests (${journey.guests.length})`}>
          {journey.guests.length === 0 ? (
            <p className="text-sm text-muted">No passengers on this journey.</p>
          ) : (
            <Table variant="secondary">
              <Table.ScrollContainer>
                <Table.Content aria-label="Guests list">
                  <Table.Header>
                    <Table.Column isRowHeader>Guest details</Table.Column>
                    <Table.Column>Contact number</Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {journey.guests.map((g, i) => (
                      <Table.Row key={`${g.kind}-${g.name}-${i}`} id={`${g.kind}-${g.name}-${i}`}>
                        <Table.Cell>
                          <div className="flex items-center gap-3">
                            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-secondary text-xs font-bold uppercase text-muted">
                              {g.name.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-foreground">{g.name}</p>
                              {g.kind === "employee" ? <p className="text-[10px] text-muted">Employee {g.employeeCode}</p> : null}
                            </div>
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          <span className="text-xs tabular-nums text-muted">{g.phone || "—"}</span>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          )}
        </SectionCard>

        {journey.displayStatus === "completed" ? (
          <SectionCard eyebrow="Passenger experience" title="Guest feedback">
            <FeedbackPanel feedback={feedback} />
          </SectionCard>
        ) : null}
      </div>

      {/* Right: the route */}
      <div className="w-full shrink-0 lg:w-80 xl:w-96">
        <SectionCard eyebrow="Journey route" title="Timeline & stops">
          <div>
            {journey.stops.map((stop, i) => (
              <RouteNode key={stop.sequenceNo} stop={stop} isLast={i === journey.stops.length - 1} />
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
