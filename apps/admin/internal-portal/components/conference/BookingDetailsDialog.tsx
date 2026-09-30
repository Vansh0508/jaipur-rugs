"use client";

import { Button, Modal } from "@jaipur-rugs/ui-kit";
import { formatDate, formatTime } from "@/lib/format";
import { bookingPhase, type ConferenceBooking } from "@/lib/queries/conference";
import { BookingStatusChip } from "./BookingStatusChip";

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-foreground">{children}</dd>
    </div>
  );
}

/**
 * One booking in full, with a Cancel booking button while it hasn't finished (the confirm
 * itself is CancelBookingDialog, owned by the workspace so the list's ⋮ menu shares it).
 */
export function BookingDetailsDialog({
  booking,
  roomColor,
  onClose,
  onCancel,
}: {
  /** The booking to show; null = closed. */
  booking: ConferenceBooking | null;
  roomColor?: string;
  onClose: () => void;
  onCancel: (booking: ConferenceBooking) => void;
}) {
  const phase = booking ? bookingPhase(booking) : null;
  const canCancel = phase === "upcoming" || phase === "ongoing";

  return (
    <Modal>
      <Modal.Backdrop isOpen={booking !== null} onOpenChange={(open) => !open && onClose()}>
        <Modal.Container scroll="inside">
          <Modal.Dialog className="sm:max-w-[480px]">
            <Modal.CloseTrigger />
            {booking && phase ? (
              <>
                <Modal.Header>
                  <div className="flex flex-col gap-2">
                    <Modal.Heading>{booking.eventName}</Modal.Heading>
                    <div>
                      <BookingStatusChip phase={phase} />
                    </div>
                  </div>
                </Modal.Header>
                <Modal.Body>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
                    <Detail label="Venue">
                      <span className="inline-flex items-center gap-2">
                        <span aria-hidden className="size-2.5 rounded-full" style={{ backgroundColor: roomColor ?? "var(--accent)" }} />
                        {booking.roomName}
                      </span>
                    </Detail>
                    <Detail label="Date">{formatDate(booking.startsAt)}</Detail>
                    <Detail label="Time">
                      {formatTime(booking.startsAt)} – {formatTime(booking.endsAt)}
                    </Detail>
                    <Detail label="Sitting arrangement">{booking.seatingCount}</Detail>
                    <Detail label="Booked for">
                      {booking.employeeName}
                      <span className="block text-xs text-muted">{booking.employeeCode}</span>
                    </Detail>
                    <Detail label="Department">{booking.departmentName ?? "—"}</Detail>
                  </dl>
                  {booking.eventDetails ? (
                    <div className="mt-4">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted">Event details</p>
                      <p className="mt-0.5 whitespace-pre-wrap text-sm text-foreground">{booking.eventDetails}</p>
                    </div>
                  ) : null}
                </Modal.Body>
                <Modal.Footer>
                  {canCancel ? (
                    <Button variant="danger-soft" onPress={() => onCancel(booking)}>
                      Cancel booking
                    </Button>
                  ) : null}
                  <Button variant="secondary" onPress={onClose}>
                    Close
                  </Button>
                </Modal.Footer>
              </>
            ) : null}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
