"use client";

import { useMemo, useState } from "react";
import { formatDate, formatTime } from "@/lib/format";
import { bookingPhase, type ConferenceBooking } from "@/lib/queries/conference";
import { ActionsMenu, type ActionSection } from "@/components/shared/ActionsMenu";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { DETAIL_PAGE_SIZE, PaginationBar } from "@/components/shared/PaginationBar";
import { DeactivateIcon, ViewIcon } from "@/components/shared/icons";
import { BookingStatusChip } from "./BookingStatusChip";

// The Bookings tab: every booking the page has loaded (recent past through the next six
// months) as the app's standard primary table. Upcoming and ongoing first, soonest at the top
// — what someone scanning the list wants — then finished and cancelled ones, most recent
// first. A row opens the booking's details; ⋮ offers View details and Cancel booking.

export function BookingsList({
  bookings,
  roomColors,
  onOpen,
  onCancel,
}: {
  bookings: ConferenceBooking[];
  roomColors: Map<string, string>;
  onOpen: (booking: ConferenceBooking) => void;
  onCancel: (booking: ConferenceBooking) => void;
}) {
  const [page, setPage] = useState(1);

  const ordered = useMemo(() => {
    const now = Date.now();
    const live = bookings.filter((b) => ["upcoming", "ongoing"].includes(bookingPhase(b, now)));
    const past = bookings.filter((b) => !["upcoming", "ongoing"].includes(bookingPhase(b, now)));
    live.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    past.sort((a, b) => b.startsAt.localeCompare(a.startsAt));
    return [...live, ...past];
  }, [bookings]);

  const columns: DataTableColumn<ConferenceBooking>[] = [
    {
      id: "event",
      label: "Event",
      isRowHeader: true,
      render: (b) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{b.eventName}</p>
          {b.eventDetails ? <p className="max-w-xs truncate text-xs text-muted">{b.eventDetails}</p> : null}
        </div>
      ),
    },
    {
      id: "venue",
      label: "Venue",
      render: (b) => (
        <span className="inline-flex items-center gap-2 text-sm text-foreground">
          <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: roomColors.get(b.roomId) }} />
          {b.roomName}
        </span>
      ),
    },
    {
      id: "when",
      label: "Date & time",
      render: (b) => (
        <div className="whitespace-nowrap">
          <p className="text-sm text-foreground">{formatDate(b.startsAt)}</p>
          <p className="text-xs text-muted tabular-nums">
            {formatTime(b.startsAt)} – {formatTime(b.endsAt)}
          </p>
        </div>
      ),
    },
    {
      id: "employee",
      label: "Booked for",
      render: (b) => (
        <div className="min-w-0">
          <p className="truncate text-sm text-foreground">{b.employeeName}</p>
          <p className="text-xs text-muted">{b.employeeCode}</p>
        </div>
      ),
    },
    { id: "department", label: "Department", render: (b) => <span className="text-sm text-muted">{b.departmentName ?? "—"}</span> },
    { id: "seats", label: "Seats", render: (b) => <span className="text-sm text-muted tabular-nums">{b.seatingCount}</span> },
    { id: "status", label: "Status", render: (b) => <BookingStatusChip phase={bookingPhase(b)} /> },
    {
      id: "actions",
      label: "Actions",
      className: "w-14 text-right",
      render: (b) => {
        const phase = bookingPhase(b);
        const sections: ActionSection[] = [
          { id: "general", items: [{ id: "view", label: "View details", icon: ViewIcon }] },
          ...(phase === "upcoming" || phase === "ongoing"
            ? [{ id: "danger", items: [{ id: "cancel", label: "Cancel booking", icon: DeactivateIcon, variant: "danger" as const }] }]
            : []),
        ];
        return (
          <div className="flex justify-end">
            <ActionsMenu
              ariaLabel={`Actions for ${b.eventName}`}
              sections={sections}
              onAction={(id) => (id === "cancel" ? onCancel(b) : onOpen(b))}
            />
          </div>
        );
      },
    },
  ];

  const pageCount = Math.max(1, Math.ceil(ordered.length / DETAIL_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);

  return (
    <div>
      <DataTable
        ariaLabel="Conference bookings"
        columns={columns}
        rows={ordered.slice((currentPage - 1) * DETAIL_PAGE_SIZE, currentPage * DETAIL_PAGE_SIZE)}
        getRowId={(b) => b.id}
        onRowAction={onOpen}
        emptyMessage="No conference bookings yet — use Book conference room to add the first one."
      />
      <PaginationBar page={currentPage} pageCount={pageCount} onPageChange={setPage} />
    </div>
  );
}
