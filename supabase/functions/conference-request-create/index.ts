// Public (verify_jwt = false) — the employee portal asks for a conference room. Creates a
// PENDING conference_booking_requests row; nothing is booked until an Internal Portal admin
// approves it (conference-request-decide), which re-runs every rule against the real bookings.
//
// Checked here too, so the employee hears about an obvious problem straight away instead of
// from a rejection: the employee code (must be an active employee), the window (one IST day,
// not already started — ../_shared/conference.ts), the room (exists, not removed), capacity, and
// that no confirmed booking already holds that time. Capped at MAX_OPEN_REQUESTS_PER_EMPLOYEE
// open requests per employee, since anyone who can reach the portal can call this.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse, parseWindow } from "../_shared/conference.ts";
import { cleanText, findActiveEmployeeByCode, MAX_OPEN_REQUESTS_PER_EMPLOYEE, UUID_PATTERN } from "../_shared/bookingRequests.ts";

interface CreateConferenceRequestBody {
  employeeCode: string;
  roomId: string;
  startsAt: string;
  endsAt: string;
  seatingCount: number;
  eventName: string;
  eventDetails?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const body = (await req.json().catch(() => ({}))) as Partial<CreateConferenceRequestBody>;
    const eventName = cleanText(body.eventName, 200);
    const eventDetails = cleanText(body.eventDetails, 2000);
    const { roomId, seatingCount } = body;

    if (typeof roomId !== "string" || !UUID_PATTERN.test(roomId)) return jsonResponse({ error: "Choose a room." }, 400);
    if (!eventName) return jsonResponse({ error: "Enter the event name." }, 400);
    if (!Number.isInteger(seatingCount) || (seatingCount as number) < 1) {
      return jsonResponse({ error: "The sitting arrangement must be a whole number of at least 1." }, 400);
    }
    const window = parseWindow(body.startsAt, body.endsAt, true);
    if ("error" in window) return jsonResponse({ error: window.error }, 400);

    const employee = await findActiveEmployeeByCode(supabaseAdmin, body.employeeCode);
    if (!employee) return jsonResponse({ error: "No active employee has that employee ID." }, 400);

    const { data: room, error: roomError } = await supabaseAdmin
      .from("conference_rooms")
      .select("id, name, capacity, status")
      .eq("id", roomId)
      .maybeSingle();
    if (roomError) return jsonResponse({ error: roomError.message }, 500);
    if (!room || room.status !== "active") return jsonResponse({ error: "That room can't be booked." }, 400);
    if (room.capacity !== null && (seatingCount as number) > room.capacity) {
      return jsonResponse({ error: `${room.name} seats ${room.capacity} — the sitting arrangement is ${seatingCount}.` }, 400);
    }

    const { count: clashes, error: clashError } = await supabaseAdmin
      .from("conference_bookings")
      .select("id", { count: "exact", head: true })
      .eq("room_id", roomId)
      .eq("status", "confirmed")
      .lt("starts_at", window.end.toISOString())
      .gt("ends_at", window.start.toISOString());
    if (clashError) return jsonResponse({ error: clashError.message }, 500);
    if (clashes && clashes > 0) {
      // Not describeConflict: that names the clashing event, and the employee portal only ever
      // shows busy blocks — say the slot is taken without naming someone else's meeting.
      return jsonResponse({ error: `${room.name} is already booked for part of that time. Pick a free slot.` }, 409);
    }

    const { count: open, error: openError } = await supabaseAdmin
      .from("conference_booking_requests")
      .select("id", { count: "exact", head: true })
      .eq("requested_by", employee.id)
      .eq("status", "pending")
      .gt("ends_at", new Date().toISOString());
    if (openError) return jsonResponse({ error: openError.message }, 500);
    if ((open ?? 0) >= MAX_OPEN_REQUESTS_PER_EMPLOYEE) {
      return jsonResponse(
        { error: `You already have ${open} conference requests waiting for approval. Wait for those to be decided first.` },
        429,
      );
    }

    const { data: created, error: insertError } = await supabaseAdmin
      .from("conference_booking_requests")
      .insert({
        room_id: roomId,
        requested_by: employee.id,
        starts_at: window.start.toISOString(),
        ends_at: window.end.toISOString(),
        seating_count: seatingCount,
        event_name: eventName,
        event_details: eventDetails,
      })
      .select("id")
      .single();
    if (insertError || !created) return jsonResponse({ error: insertError?.message ?? "insert failed" }, 500);

    return jsonResponse({ id: created.id }, 201);
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "request failed" }, 500);
  }
});
