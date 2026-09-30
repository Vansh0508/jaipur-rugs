import { getServerSupabaseClient } from "@/lib/supabaseClient.server";
import { todayInAppZone } from "@/lib/format";
import { addDays, istInstantMs, parseConferenceView, parseDateParam, visibleRange } from "@/lib/conference/calendar";
import { listConferenceBookings, listConferenceRooms } from "@/lib/queries/conference";
import { ConferenceWorkspace } from "@/components/conference/ConferenceWorkspace";
import { listPendingConferenceRequests, requestsOrEmpty } from "@/lib/queries/bookingRequests";

// Days of history / future always loaded besides whatever the calendar is showing, so the
// Bookings tab has recent and upcoming meetings to list however far the calendar is paged.
const HISTORY_DAYS = 30;
const FUTURE_DAYS = 180;

export default async function ConferencePage({ searchParams }: { searchParams: Promise<{ view?: string; date?: string; room?: string }> }) {
  const params = await searchParams;
  const view = parseConferenceView(params.view);
  const date = parseDateParam(params.date);
  const supabase = await getServerSupabaseClient();

  // One query covering the visible range plus the list's standing window.
  const range = visibleRange(view, date);
  const today = todayInAppZone();
  const from = [range.from, addDays(today, -HISTORY_DAYS)].sort()[0]!;
  const to = [range.to, addDays(today, FUTURE_DAYS)].sort().reverse()[0]!;

  const [rooms, bookings, requests] = await Promise.all([
    listConferenceRooms(supabase),
    listConferenceBookings(supabase, new Date(istInstantMs(from, 0)).toISOString(), new Date(istInstantMs(addDays(to, 1), 0)).toISOString()),
    requestsOrEmpty(listPendingConferenceRequests(supabase)),
  ]);

  // A ?room= that isn't a real room (stale link) falls back to all rooms.
  const roomFilter = params.room && rooms.some((room) => room.id === params.room) ? params.room : "all";

  return <ConferenceWorkspace rooms={rooms} bookings={bookings} requests={requests} view={view} date={date} roomFilter={roomFilter} />;
}
