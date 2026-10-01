"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Chip, Disclosure } from "@heroui/react";
import { Button } from "@jaipur-rugs/ui-kit";
import {
  isRequestExpired,
  requestStartsAt,
  type BookingRequest,
  type ConferenceRequest,
  type JourneyRequest,
} from "@/lib/queries/bookingRequests";
import { formatDate, formatTime } from "@/lib/format";
import { EmptyState } from "@/components/shared/EmptyState";
import { PaginationBar } from "@/components/shared/PaginationBar";
import { ApproveConferenceDialog, ApproveJourneyDialog, RejectRequestDialog } from "./DecisionDialogs";

// Employee requests waiting on an admin (db/booking-requests/): each one says who asked,
// for when, and what — the room and event, or the route and passengers — with Approve and
// Reject. Used on the Dashboard (both kinds), the Journeys page (journey requests) and the
// Conference page's Requests tab (conference requests). A decided request drops out of the
// list straight away and the page is refreshed, so the new booking/journey shows up too.
// Earliest slot first; one whose time has already gone can only be rejected.

const PAGE_SIZE = 6;

function KindChip({ kind }: { kind: BookingRequest["kind"] }) {
  return (
    <Chip size="sm" variant="soft" color={kind === "journey" ? "accent" : "warning"}>
      <Chip.Label>{kind === "journey" ? "Journey" : "Conference room"}</Chip.Label>
    </Chip>
  );
}

function timeRange(start: string, end: string) {
  const from = formatDate(start);
  const to = formatDate(end);
  return from === to ? `${from} · ${formatTime(start)} – ${formatTime(end)}` : `${from} ${formatTime(start)} – ${to} ${formatTime(end)}`;
}

function ConferenceDetails({ request }: { request: ConferenceRequest }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-sm font-semibold text-foreground">{request.eventName}</p>
      <p className="text-xs text-muted">
        {request.roomName} · {request.seatingCount} seat{request.seatingCount === 1 ? "" : "s"}
        {request.roomCapacity ? ` (room seats ${request.roomCapacity})` : ""}
      </p>
      {request.eventDetails ? <p className="mt-1 line-clamp-2 text-xs text-muted">{request.eventDetails}</p> : null}
    </div>
  );
}

function JourneyDetails({ request }: { request: JourneyRequest }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-sm font-semibold text-foreground" title={request.routeSummary}>
        {request.routeSummary}
      </p>
      <p className="text-xs text-muted">
        {request.passengerCount} passenger{request.passengerCount === 1 ? "" : "s"} · {request.stops.length} stop{request.stops.length === 1 ? "" : "s"}
      </p>
      {request.notes ? <p className="mt-1 line-clamp-2 text-xs text-muted">{request.notes}</p> : null}
      <Disclosure className="mt-2">
        <Disclosure.Heading>
          <Disclosure.Trigger className="flex items-center gap-1 text-xs font-medium text-accent">
            Route and passengers
            <Disclosure.Indicator className="size-3" />
          </Disclosure.Trigger>
        </Disclosure.Heading>
        <Disclosure.Content>
          <Disclosure.Body>
            <ol className="mt-2 flex flex-col gap-2 border-l-2 border-dashed border-border pl-3">
              {request.stops.map((stop) => (
                <li key={stop.sequenceNo} className="text-xs">
                  <p className="font-semibold text-foreground">
                    {stop.locationName} <span className="font-normal text-muted tabular-nums">· {formatTime(stop.arrivalAt)}</span>
                  </p>
                  {stop.pickups.length > 0 ? (
                    <p className="text-success">Picks up: {stop.pickups.map((g) => (g.kind === "employee" ? `${g.name} (${g.employeeCode})` : g.name)).join(", ")}</p>
                  ) : null}
                  {stop.drops.length > 0 ? (
                    <p className="text-warning">Drops off: {stop.drops.map((g) => (g.kind === "employee" ? `${g.name} (${g.employeeCode})` : g.name)).join(", ")}</p>
                  ) : null}
                </li>
              ))}
            </ol>
          </Disclosure.Body>
        </Disclosure.Content>
      </Disclosure>
    </div>
  );
}

function RequestRow({
  request,
  onApprove,
  onReject,
}: {
  request: BookingRequest;
  onApprove: (request: BookingRequest) => void;
  onReject: (request: BookingRequest) => void;
}) {
  const expired = isRequestExpired(request);
  const start = requestStartsAt(request);
  const end = request.kind === "conference" ? request.endsAt : request.lastDropAt;
  return (
    <li className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <KindChip kind={request.kind} />
          <span className="text-xs font-medium tabular-nums text-foreground">{timeRange(start, end)}</span>
          {expired ? (
            <Chip size="sm" variant="soft" color="danger">
              <Chip.Label>Time has passed</Chip.Label>
            </Chip>
          ) : null}
        </div>
        {request.kind === "conference" ? <ConferenceDetails request={request} /> : <JourneyDetails request={request} />}
        <p className="text-[11px] text-muted">
          Requested by <span className="font-medium text-foreground">{request.requester.fullName}</span>
          {request.requester.employeeCode ? <span className="tabular-nums"> · {request.requester.employeeCode}</span> : null}
          {request.requester.departmentName ? ` · ${request.requester.departmentName}` : ""} · sent {formatDate(request.createdAt)}{" "}
          {formatTime(request.createdAt)}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button size="sm" variant="secondary" onPress={() => onReject(request)}>
          Reject
        </Button>
        <Button size="sm" onPress={() => onApprove(request)} isDisabled={expired}>
          Approve
        </Button>
      </div>
    </li>
  );
}

export function RequestsPanel({
  requests,
  title = "Booking requests",
  description,
  emptyMessage = "No requests waiting for approval.",
}: {
  requests: BookingRequest[];
  title?: string;
  description?: string;
  emptyMessage?: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState(requests);
  const [page, setPage] = useState(1);
  const [approving, setApproving] = useState<BookingRequest | null>(null);
  const [rejecting, setRejecting] = useState<BookingRequest | null>(null);
  useEffect(() => setItems(requests), [requests]);

  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const visible = items.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  function decided(request: BookingRequest) {
    setItems((prev) => prev.filter((r) => r.id !== request.id));
    setApproving(null);
    setRejecting(null);
    router.refresh();
  }

  return (
    <Card>
      <Card.Header>
        <div className="flex items-center gap-2">
          <Card.Title>{title}</Card.Title>
          {items.length > 0 ? <span className="rounded-full bg-warning px-2 py-0.5 text-[10px] font-bold text-white">{items.length}</span> : null}
        </div>
        <Card.Description>{description ?? "Sent by employees from the employee portal. Nothing is booked until you approve it."}</Card.Description>
      </Card.Header>
      <Card.Content>
        {items.length === 0 ? (
          <EmptyState message={emptyMessage} />
        ) : (
          <>
            <ul className="flex flex-col gap-3">
              {visible.map((request) => (
                <RequestRow key={request.id} request={request} onApprove={setApproving} onReject={setRejecting} />
              ))}
            </ul>
            <PaginationBar page={current} pageCount={pageCount} onPageChange={setPage} />
          </>
        )}
      </Card.Content>

      <ApproveConferenceDialog
        request={approving?.kind === "conference" ? approving : null}
        onClose={() => setApproving(null)}
        onDecided={decided}
      />
      <ApproveJourneyDialog request={approving?.kind === "journey" ? approving : null} onClose={() => setApproving(null)} onDecided={decided} />
      <RejectRequestDialog request={rejecting} onClose={() => setRejecting(null)} onDecided={decided} />
    </Card>
  );
}
