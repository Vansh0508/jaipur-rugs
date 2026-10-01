// Public (verify_jwt = false) — the employee portal asks for a journey. Creates a PENDING
// journey_requests row holding the proposed trip (passengers + route); no car or driver —
// the Internal Portal admin assigns those when approving (journey-request-decide), which
// hands the trip to create_journey and so re-runs every journey rule.
//
// Validated here so a bad trip never reaches an admin (../_shared/bookingRequests.ts
// validateTrip): route shape, times in order, each passenger picked up once and dropped off
// later, employee passengers active, guests with a name and a valid phone. The first pickup
// must be in the future. Capped at MAX_OPEN_REQUESTS_PER_EMPLOYEE open requests per employee.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/conference.ts";
import { cleanText, findActiveEmployeeByCode, MAX_OPEN_REQUESTS_PER_EMPLOYEE, validateTrip } from "../_shared/bookingRequests.ts";
import { inBackground, journeyEmail, sendBookingEmail } from "../_shared/bookingEmails.ts";

interface CreateJourneyRequestBody {
  employeeCode: string;
  guests: unknown;
  stops: unknown;
  notes?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const body = (await req.json().catch(() => ({}))) as Partial<CreateJourneyRequestBody>;

    const employee = await findActiveEmployeeByCode(supabaseAdmin, body.employeeCode);
    if (!employee) return jsonResponse({ error: "No active employee has that employee ID." }, 400);

    const result = await validateTrip(supabaseAdmin, body.guests, body.stops);
    if ("error" in result) return jsonResponse({ error: result.error }, 400);
    const { trip } = result;

    if (new Date(trip.firstPickupAt) <= new Date()) {
      return jsonResponse({ error: "The first pickup has already passed — pick a time from now on." }, 400);
    }

    const { count: open, error: openError } = await supabaseAdmin
      .from("journey_requests")
      .select("id", { count: "exact", head: true })
      .eq("requested_by", employee.id)
      .eq("status", "pending")
      .gt("last_drop_at", new Date().toISOString());
    if (openError) return jsonResponse({ error: openError.message }, 500);
    if ((open ?? 0) >= MAX_OPEN_REQUESTS_PER_EMPLOYEE) {
      return jsonResponse(
        { error: `You already have ${open} journey requests waiting for approval. Wait for those to be decided first.` },
        429,
      );
    }

    const { data: created, error: insertError } = await supabaseAdmin
      .from("journey_requests")
      .insert({
        requested_by: employee.id,
        trip: { guests: trip.guests, stops: trip.stops },
        first_pickup_at: trip.firstPickupAt,
        last_drop_at: trip.lastDropAt,
        route_summary: trip.routeSummary,
        passenger_count: trip.guests.length,
        notes: cleanText(body.notes, 2000),
      })
      .select("id")
      .single();
    if (insertError || !created) return jsonResponse({ error: insertError?.message ?? "insert failed" }, 500);

    // "Journey Booking Sent (Confirmation Pending)" — after the response, never blocking it.
    inBackground(
      sendBookingEmail(
        supabaseAdmin,
        "journey_request_sent",
        employee.id,
        journeyEmail("journey_request_sent", {
          routeSummary: trip.routeSummary,
          firstPickupAt: trip.firstPickupAt,
          lastDropAt: trip.lastDropAt,
          passengerCount: trip.guests.length,
          reference: created.id,
        }),
        { journeyRequestId: created.id },
      ),
    );

    return jsonResponse({ id: created.id }, 201);
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "request failed" }, 500);
  }
});
