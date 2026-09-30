"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cancelConferenceBooking } from "@jaipur-rugs/db-management-client";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient.browser";
import { formatDate, formatTime } from "@/lib/format";
import type { ConferenceBooking } from "@/lib/queries/conference";
import { ActionDialog } from "@/components/shared/ActionDialog";

/**
 * Confirm-then-cancel for one booking, shared by the details dialog and the bookings list's
 * ⋮ menu. Cancelling frees the slot (the exclusion constraint only covers confirmed
 * bookings) but keeps the row for history, so it's behind a confirm. `booking` null = closed;
 * `onClose` fires on dismiss and after a successful cancel alike.
 */
export function CancelBookingDialog({ booking, onClose }: { booking: ConferenceBooking | null; onClose: () => void }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCancel() {
    if (!booking) return;
    setPending(true);
    try {
      await cancelConferenceBooking(getBrowserSupabaseClient(), booking.id);
      onClose();
      router.refresh();
    } catch (err) {
      onClose();
      setError(err instanceof Error ? err.message : "Could not cancel the booking.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <ActionDialog
        isOpen={booking !== null}
        onOpenChange={(open) => !open && onClose()}
        heading={booking ? `Cancel “${booking.eventName}”?` : ""}
        body={
          booking
            ? `${booking.roomName} will be free again for ${formatTime(booking.startsAt)} – ${formatTime(booking.endsAt)} on ${formatDate(booking.startsAt)}.`
            : null
        }
        confirmLabel="Cancel booking"
        cancelLabel="Keep booking"
        isPending={pending}
        onConfirm={handleCancel}
      />
      <ActionDialog isOpen={error !== null} onOpenChange={(open) => !open && setError(null)} heading="Couldn't cancel the booking" body={error} />
    </>
  );
}
