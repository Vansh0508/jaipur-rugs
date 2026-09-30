// db-management write endpoint: approve or reject an employee's conference room request.
// Internal Portal admin only (../_shared/authz.ts). The work is public.decide_conference_request
// (db/booking-requests/003) — one transaction that locks the request, re-checks the room,
// capacity, employee and time, creates the conference_bookings row and links it. A clash with
// a confirmed booking is the room's EXCLUDE constraint (23P01), worded by describeConflict.

import { createClient } from "npm:@supabase/supabase-js@2";
import { requireInternalPortalAdmin, authzErrorResponse } from "../_shared/authz.ts";
import { corsHeaders, describeConflict, EXCLUSION_VIOLATION, jsonResponse } from "../_shared/conference.ts";
import { cleanText, describeDecisionError, UUID_PATTERN } from "../_shared/bookingRequests.ts";

interface DecideConferenceRequestBody {
  requestId: string;
  decision: "approved" | "rejected";
  note?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const admin = await requireInternalPortalAdmin(supabaseAdmin, supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, req);

    const body = (await req.json()) as Partial<DecideConferenceRequestBody>;
    if (typeof body.requestId !== "string" || !UUID_PATTERN.test(body.requestId)) {
      return jsonResponse({ error: "requestId is required" }, 400);
    }
    if (body.decision !== "approved" && body.decision !== "rejected") {
      return jsonResponse({ error: "decision must be approved or rejected" }, 400);
    }

    const { data: bookingId, error } = await supabaseAdmin.rpc("decide_conference_request", {
      p_request_id: body.requestId,
      p_admin_id: admin.employeeId,
      p_decision: body.decision,
      p_note: cleanText(body.note, 1000),
    });

    if (error) {
      if (error.code === EXCLUSION_VIOLATION) {
        const { data: request } = await supabaseAdmin
          .from("conference_booking_requests")
          .select("room_id, starts_at, ends_at")
          .eq("id", body.requestId)
          .maybeSingle();
        const message = request
          ? await describeConflict(supabaseAdmin, request.room_id, new Date(request.starts_at), new Date(request.ends_at))
          : "This room is already booked for that time.";
        return jsonResponse({ error: `${message} Reject this request, or ask the employee for another time.` }, 409);
      }
      const known = describeDecisionError(error.message);
      if (known) return jsonResponse({ error: known.error }, known.status);
      return jsonResponse({ error: error.message }, 500);
    }

    return jsonResponse({ decision: body.decision, bookingId: bookingId ?? null });
  } catch (err) {
    return authzErrorResponse(err, corsHeaders);
  }
});
