// db-management write endpoint: change a booking's time — what stretching or contracting a
// meeting on the calendar/timeline does. Internal Portal admin only. Only the window moves
// (same room, same day); the event's details aren't editable here.
//
// Rejected (400/404/409):
// - a window that isn't within one IST day (../_shared/conference.ts);
// - a booking that's cancelled, or has already finished — history isn't rewritten;
// - moving the start to a time that has already passed (an upcoming meeting can't be pulled
//   into the past; one under way keeps its start), or the end to one that has;
// - an overlap with another confirmed booking of the same room (the exclusion constraint's
//   23P01, worded by describeConflict, which ignores this booking itself).

import { createClient } from "npm:@supabase/supabase-js@2";
import { requireInternalPortalAdmin, authzErrorResponse } from "../_shared/authz.ts";
import {
  corsHeaders,
  describeConflict,
  EXCLUSION_VIOLATION,
  jsonResponse,
  parseWindow,
  startHasPassed,
} from "../_shared/conference.ts";

interface UpdateBookingBody {
  bookingId: string;
  startsAt: string;
  endsAt: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    await requireInternalPortalAdmin(supabaseAdmin, supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, req);

    const body = (await req.json()) as Partial<UpdateBookingBody>;
    if (!body.bookingId) {
      return jsonResponse({ error: "bookingId is required" }, 400);
    }
    // A meeting that's under way can be stretched or contracted, so the new window needn't be
    // wholly in the future — only the booking as it stands must not be over.
    const window = parseWindow(body.startsAt, body.endsAt, false);
    if ("error" in window) {
      return jsonResponse({ error: window.error }, 400);
    }

    const { data: booking, error: bookingError } = await supabaseAdmin
      .from("conference_bookings")
      .select("id, room_id, status, starts_at, ends_at")
      .eq("id", body.bookingId)
      .maybeSingle();
    if (bookingError) return jsonResponse({ error: bookingError.message }, 500);
    if (!booking) return jsonResponse({ error: "booking not found" }, 404);
    if (booking.status !== "confirmed") {
      return jsonResponse({ error: "This booking has been cancelled." }, 409);
    }
    if (new Date(booking.ends_at) <= new Date()) {
      return jsonResponse({ error: "This booking has already finished and can't be changed." }, 409);
    }
    const startMoved = window.start.getTime() !== new Date(booking.starts_at).getTime();
    if (startMoved && startHasPassed(window.start)) {
      return jsonResponse({ error: "A meeting can't be moved to start at a time that has already passed." }, 400);
    }
    if (window.end <= new Date()) {
      return jsonResponse({ error: "The end time has already passed — pick a time from now on." }, 400);
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("conference_bookings")
      .update({
        starts_at: window.start.toISOString(),
        ends_at: window.end.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", body.bookingId)
      .select("id, starts_at, ends_at")
      .single();

    if (updateError || !updated) {
      if (updateError?.code === EXCLUSION_VIOLATION) {
        return jsonResponse(
          { error: await describeConflict(supabaseAdmin, booking.room_id, window.start, window.end, booking.id) },
          409,
        );
      }
      return jsonResponse({ error: updateError?.message ?? "update failed" }, 500);
    }

    return jsonResponse(updated);
  } catch (err) {
    return authzErrorResponse(err, corsHeaders);
  }
});
