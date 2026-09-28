// db-management write endpoint: "Mark ended" (driver-app-new's end-journey) — sets a
// started journey to `completed`. Internal Portal admin only.
//
// Ending early must actually free the car and driver: the no-double-booking EXCLUDE
// constraints (db/journeys/002) keep every non-cancelled journey's busy_window reserved,
// and that window runs to last_drop_at. So when now() is before last_drop_at, last_drop_at
// is pulled back to now() too (busy_window / date_to follow — generated column + trigger).
// The planned stop arrival times are left untouched as the record of what was planned.
//
// Blocked (409) for a journey that hasn't started yet (now() < first_pickup_at) — that's
// a cancellation, not an ending (cancel-journey) — and for cancelled/completed ones.

import { createClient } from "npm:@supabase/supabase-js@2";
import { requireInternalPortalAdmin, authzErrorResponse } from "../_shared/authz.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CompleteJourneyBody {
  journeyId: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    await requireInternalPortalAdmin(supabaseAdmin, supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, req);

    const body = (await req.json()) as Partial<CompleteJourneyBody>;
    if (!body.journeyId) {
      return jsonResponse({ error: "journeyId is required" }, 400);
    }

    const { data: journey, error: fetchError } = await supabaseAdmin
      .from("journeys")
      .select("id, status, first_pickup_at, last_drop_at")
      .eq("id", body.journeyId)
      .maybeSingle();
    if (fetchError) {
      return jsonResponse({ error: fetchError.message }, 500);
    }
    if (!journey) {
      return jsonResponse({ error: "journey not found" }, 404);
    }
    if (journey.status === "cancelled" || journey.status === "completed") {
      return jsonResponse({ error: `This journey is already ${journey.status}.` }, 409);
    }

    const now = new Date();
    if (now < new Date(journey.first_pickup_at)) {
      return jsonResponse({ error: "This journey hasn't started yet — cancel it instead." }, 409);
    }

    const changes: Record<string, string> = { status: "completed", updated_at: now.toISOString() };
    if (now < new Date(journey.last_drop_at)) {
      changes.last_drop_at = now.toISOString();
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("journeys")
      .update(changes)
      .eq("id", journey.id)
      .in("status", ["planned", "ongoing"])
      .select("id, status, last_drop_at")
      .maybeSingle();
    if (updateError) {
      return jsonResponse({ error: updateError.message }, 500);
    }
    if (!updated) {
      return jsonResponse({ error: "This journey was changed by someone else — reload and try again." }, 409);
    }

    return jsonResponse(updated);
  } catch (err) {
    return authzErrorResponse(err, corsHeaders);
  }
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
