// db-management write endpoint: book a conference room for an employee. Internal Portal
// admin only, see ../_shared/authz.ts. The employee is identified by id (the booking form
// resolves the typed employee code to one) and re-verified here — active, and that's it;
// their name/department are read from `employees` whenever they're shown, never stored.
//
// Rejected (400/409):
// - a window that isn't within one IST day, or whose start has passed (../_shared/conference.ts);
// - a room that doesn't exist or has been removed (inactive);
// - a sitting arrangement above the room's capacity, when the room has one;
// - an overlap with another confirmed booking of the room — the database's exclusion
//   constraint is the guarantee, this function only words its 23P01 (409).

import { createClient } from "npm:@supabase/supabase-js@2";
import { requireInternalPortalAdmin, authzErrorResponse } from "../_shared/authz.ts";
import {
  corsHeaders,
  describeConflict,
  EXCLUSION_VIOLATION,
  jsonResponse,
  parseWindow,
} from "../_shared/conference.ts";
import { conferenceEmail, inBackground, sendBookingEmail } from "../_shared/bookingEmails.ts";

interface CreateBookingBody {
  roomId: string;
  employeeId: string;
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

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const admin = await requireInternalPortalAdmin(supabaseAdmin, supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, req);

    const body = (await req.json()) as Partial<CreateBookingBody>;
    const eventName = body.eventName?.trim();
    const eventDetails = body.eventDetails?.trim() || null;
    const { roomId, employeeId, seatingCount } = body;

    if (!roomId || !employeeId || !eventName) {
      return jsonResponse({ error: "roomId, employeeId and eventName are required" }, 400);
    }
    if (!Number.isInteger(seatingCount) || (seatingCount as number) < 1) {
      return jsonResponse({ error: "The sitting arrangement must be a whole number of at least 1." }, 400);
    }
    const window = parseWindow(body.startsAt, body.endsAt, true);
    if ("error" in window) {
      return jsonResponse({ error: window.error }, 400);
    }

    const [{ data: room, error: roomError }, { data: employee, error: employeeError }] = await Promise.all([
      supabaseAdmin.from("conference_rooms").select("id, name, capacity, description, status").eq("id", roomId).maybeSingle(),
      supabaseAdmin.from("employees").select("id, status").eq("id", employeeId).maybeSingle(),
    ]);
    if (roomError) return jsonResponse({ error: roomError.message }, 500);
    if (employeeError) return jsonResponse({ error: employeeError.message }, 500);

    if (!room) return jsonResponse({ error: "conference room not found" }, 404);
    if (room.status !== "active") {
      return jsonResponse({ error: `${room.name} has been removed and can't be booked.` }, 409);
    }
    if (!employee || employee.status !== "active") {
      return jsonResponse({ error: "No active employee with that ID." }, 400);
    }
    if (room.capacity !== null && (seatingCount as number) > room.capacity) {
      return jsonResponse({ error: `${room.name} seats ${room.capacity} — the sitting arrangement is ${seatingCount}.` }, 400);
    }

    const { data: created, error: insertError } = await supabaseAdmin
      .from("conference_bookings")
      .insert({
        room_id: roomId,
        employee_id: employeeId,
        starts_at: window.start.toISOString(),
        ends_at: window.end.toISOString(),
        seating_count: seatingCount,
        event_name: eventName,
        event_details: eventDetails,
        created_by: admin.employeeId,
      })
      .select("id")
      .single();

    if (insertError || !created) {
      if (insertError?.code === EXCLUSION_VIOLATION) {
        return jsonResponse({ error: await describeConflict(supabaseAdmin, roomId, window.start, window.end) }, 409);
      }
      return jsonResponse({ error: insertError?.message ?? "insert failed" }, 500);
    }

    // Booked directly by an admin: "Conference Booking Confirmed" to the employee it's for.
    inBackground(
      sendBookingEmail(
        supabaseAdmin,
        "conference_confirmed",
        employeeId,
        conferenceEmail("conference_confirmed", {
          roomName: room.name,
          roomDescription: room.description,
          startsAt: window.start.toISOString(),
          endsAt: window.end.toISOString(),
          seatingCount: seatingCount as number,
          eventName,
        }),
        { conferenceBookingId: created.id },
      ),
    );

    return jsonResponse({ id: created.id }, 201);
  } catch (err) {
    return authzErrorResponse(err, corsHeaders);
  }
});
