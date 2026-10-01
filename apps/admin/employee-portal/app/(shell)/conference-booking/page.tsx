import { getConferenceAvailability } from "@jaipur-rugs/db-management-client";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { addDays, istInstantMs, parseConferenceView, parseDateParam, visibleRange } from "@/lib/conference/calendar";
import { toCalendarData, type ConferenceBooking, type ConferenceRoom } from "@/lib/queries/conference";
import { ConferenceRequestWorkspace } from "@/components/conference/ConferenceRequestWorkspace";

// Rooms and busy slots for what the calendar shows, from conference-availability (the only
// read this page makes — there's no session to read tables with). View, date and room filter
// live in the URL, same as the admin calendar.

export default async function ConferenceBookingPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string; room?: string }>;
}) {
  const params = await searchParams;
  const view = parseConferenceView(params.view);
  const date = parseDateParam(params.date);
  const range = visibleRange(view, date);

  let rooms: ConferenceRoom[] = [];
  let busy: ConferenceBooking[] = [];
  let pending: ConferenceBooking[] = [];
  let loadError: string | null = null;
  try {
    const availability = await getConferenceAvailability(
      getSupabaseClient(),
      new Date(istInstantMs(range.from, 0)).toISOString(),
      new Date(istInstantMs(addDays(range.to, 1), 0)).toISOString(),
    );
    ({ rooms, bookings: busy, pending } = toCalendarData(availability));
  } catch (err) {
    loadError = err instanceof Error ? err.message : "unknown error";
  }

  // A ?room= that isn't a real room (stale link) falls back to all rooms.
  const roomFilter = params.room && rooms.some((room) => room.id === params.room) ? params.room : "all";

  return <ConferenceRequestWorkspace rooms={rooms} busy={busy} pending={pending} view={view} date={date} roomFilter={roomFilter} loadError={loadError} />;
}
