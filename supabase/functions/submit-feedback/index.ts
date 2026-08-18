// db-management write endpoint: the only way a `feedback` row is created. FEEDBACK has no
// client-side INSERT policy (see db/feedback/feedback-schema.mmd) — this function is the
// sole write path, exactly like AGENTS.md Section 9 requires for every table.
//
// Two reviewer paths, exactly one required per request — neither is a Supabase Auth
// session anymore (see db/feedback/006_employee_code_phone_login.sql):
// - Guest: `guestId`, returned by guest-signup (phone match-or-create).
// - Employee: `employeeId`, returned by employee-signin (employee_code + phone match).
// Neither is cryptographically verified identity — both are plain data labels, matching
// the "just data entry for tracking" design. Only that the referenced row exists (and,
// for employees, is active) is checked.
//
// Planned vs unplanned (added for the Internal Portal's fraud-prevention ask, see
// db/journeys/004_feedback_planned_and_moderation.sql): an optional `journeyId` links the
// review to a real planned ride for this driver — if present and it checks out,
// review_status is 'approved' immediately (a journey record corroborates it). If absent,
// there's nothing to corroborate an unplanned claim against, so it starts 'pending' until
// an Internal Portal admin approves/rejects it via approve-feedback.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SubmitFeedbackBody {
  driverId: string;
  travelDate: string;
  rating: number;
  description?: string;
  guestId?: string;
  employeeId?: string;
  journeyId?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as Partial<SubmitFeedbackBody>;
    const { driverId, travelDate, rating, description, guestId, employeeId, journeyId } = body;

    if (!driverId || !travelDate || rating === undefined) {
      return jsonResponse({ error: "driverId, travelDate, and rating are required" }, 400);
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return jsonResponse({ error: "rating must be an integer between 1 and 5" }, 400);
    }
    const parsedDate = new Date(`${travelDate}T00:00:00Z`);
    if (Number.isNaN(parsedDate.getTime())) {
      return jsonResponse({ error: "travelDate must be a valid date (yyyy-mm-dd)" }, 400);
    }
    if (parsedDate.getTime() > Date.now()) {
      return jsonResponse({ error: "travelDate cannot be in the future" }, 400);
    }
    if (!guestId && !employeeId) {
      return jsonResponse({ error: "guestId or employeeId is required" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    let reviewerGuestId: string | null = null;
    let reviewerEmployeeId: string | null = null;

    if (guestId) {
      const { data: guest, error: guestError } = await supabaseAdmin
        .from("guests")
        .select("id")
        .eq("id", guestId)
        .maybeSingle();
      if (guestError) {
        return jsonResponse({ error: guestError.message }, 500);
      }
      if (!guest) {
        return jsonResponse({ error: "guest not found" }, 404);
      }
      reviewerGuestId = guest.id;
    } else {
      const { data: employee, error: employeeError } = await supabaseAdmin
        .from("employees")
        .select("id, status")
        .eq("id", employeeId)
        .maybeSingle();
      if (employeeError) {
        return jsonResponse({ error: employeeError.message }, 500);
      }
      if (!employee || employee.status !== "active") {
        return jsonResponse({ error: "employee not found or not active" }, 404);
      }
      reviewerEmployeeId = employee.id;
    }

    const { data: driver, error: driverError } = await supabaseAdmin
      .from("drivers")
      .select("id, status")
      .eq("id", driverId)
      .maybeSingle();

    if (driverError) {
      return jsonResponse({ error: driverError.message }, 500);
    }
    if (!driver || driver.status !== "active") {
      return jsonResponse({ error: "driver not found or not active" }, 404);
    }

    let reviewStatus: "approved" | "pending" = "approved";
    if (journeyId) {
      const { data: journey, error: journeyError } = await supabaseAdmin
        .from("journeys")
        .select("id, driver_id")
        .eq("id", journeyId)
        .maybeSingle();
      if (journeyError) {
        return jsonResponse({ error: journeyError.message }, 500);
      }
      if (!journey || journey.driver_id !== driverId) {
        return jsonResponse({ error: "journeyId does not name a journey for this driver" }, 400);
      }
      // A journey record corroborates the ride happened — auto-approved.
      reviewStatus = "approved";
    } else {
      // No journey to corroborate an unplanned claim against — pending admin review.
      reviewStatus = "pending";
    }

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("feedback")
      .insert({
        driver_id: driverId,
        guest_id: reviewerGuestId,
        employee_id: reviewerEmployeeId,
        journey_id: journeyId ?? null,
        review_status: reviewStatus,
        travel_date: travelDate,
        rating,
        description: description?.trim() || null,
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      return jsonResponse({ error: insertError?.message ?? "insert failed" }, 500);
    }

    return jsonResponse({ id: inserted.id, reviewStatus });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "unexpected error" }, 500);
  }
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
