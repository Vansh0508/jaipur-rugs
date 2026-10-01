// db-management write endpoint: approve or reject an employee's journey request. Internal
// Portal admin only (../_shared/authz.ts). Approving needs the car and driver the admin picked;
// public.decide_journey_request (db/booking-requests/003) locks the request and hands its trip
// plus that car/driver to create_journey in the same transaction, so every journey rule
// applies exactly as for an admin-planned journey — including the car/driver double-booking
// guarantee, whose `journey_conflict:...` error is parsed the same way create-journey does.

import { createClient } from "npm:@supabase/supabase-js@2";
import { requireInternalPortalAdmin, authzErrorResponse } from "../_shared/authz.ts";
import { corsHeaders, jsonResponse } from "../_shared/conference.ts";
import { cleanText, describeDecisionError, UUID_PATTERN } from "../_shared/bookingRequests.ts";
import { inBackground, journeyEmail, loadJourneyForEmail, sendBookingEmail } from "../_shared/bookingEmails.ts";

interface DecideJourneyRequestBody {
  requestId: string;
  decision: "approved" | "rejected";
  note?: string | null;
  /** Required when approving. */
  vehicleId?: string;
  driverId?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const admin = await requireInternalPortalAdmin(supabaseAdmin, supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, req);

    const body = (await req.json()) as Partial<DecideJourneyRequestBody>;
    if (typeof body.requestId !== "string" || !UUID_PATTERN.test(body.requestId)) {
      return jsonResponse({ error: "requestId is required" }, 400);
    }
    if (body.decision !== "approved" && body.decision !== "rejected") {
      return jsonResponse({ error: "decision must be approved or rejected" }, 400);
    }
    if (body.decision === "approved") {
      if (typeof body.vehicleId !== "string" || !UUID_PATTERN.test(body.vehicleId) || typeof body.driverId !== "string" || !UUID_PATTERN.test(body.driverId)) {
        return jsonResponse({ error: "Choose a car and a driver to approve this journey." }, 400);
      }
    }

    const { data: journeyId, error } = await supabaseAdmin.rpc("decide_journey_request", {
      p_request_id: body.requestId,
      p_admin_id: admin.employeeId,
      p_decision: body.decision,
      p_note: cleanText(body.note, 1000),
      p_vehicle_id: body.decision === "approved" ? body.vehicleId : null,
      p_driver_id: body.decision === "approved" ? body.driverId : null,
    });

    if (error) {
      const conflict = error.message.match(/journey_conflict:(vehicle|driver):([0-9a-f-]+):([0-9-]+):([0-9-]+)/);
      if (conflict) {
        const [, resource, conflictJourneyId, dateFrom, dateTo] = conflict;
        return jsonResponse(
          {
            error: `That ${resource === "vehicle" ? "car" : "driver"} is already on another journey then. Pick a different one.`,
            conflict: { resource, journeyId: conflictJourneyId, dateFrom, dateTo },
          },
          409,
        );
      }
      const known = describeDecisionError(error.message);
      if (known) return jsonResponse({ error: known.error }, known.status);
      return jsonResponse({ error: error.message }, 400);
    }

    // "Journey Booking Confirmed" (with the car and driver) / "Journey Booking Rejected" to the requester.
    const decision = body.decision;
    const requestId = body.requestId;
    inBackground(
      (async () => {
        const { data: request } = await supabaseAdmin
          .from("journey_requests")
          .select("requested_by, route_summary, first_pickup_at, last_drop_at, passenger_count, decision_note")
          .eq("id", requestId)
          .maybeSingle();
        if (!request) return;
        const planned = decision === "approved" && journeyId ? await loadJourneyForEmail(supabaseAdmin, journeyId as string) : null;
        const event = decision === "approved" ? "journey_confirmed" : "journey_rejected";
        await sendBookingEmail(
          supabaseAdmin,
          event,
          request.requested_by as string,
          journeyEmail(event, {
            routeSummary: request.route_summary as string,
            firstPickupAt: request.first_pickup_at as string,
            lastDropAt: request.last_drop_at as string,
            passengerCount: request.passenger_count as number,
            carLabel: planned?.info.carLabel,
            driverName: planned?.info.driverName,
            reference: requestId,
            note: request.decision_note as string | null,
          }),
          { journeyRequestId: requestId, journeyId: (journeyId as string | null) ?? null },
        );
      })(),
    );

    return jsonResponse({ decision: body.decision, journeyId: journeyId ?? null });
  } catch (err) {
    return authzErrorResponse(err, corsHeaders);
  }
});
