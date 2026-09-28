// db-management write endpoint: set a car's status — vacant, maintenance, accidental, or
// inactive (soft-delete; db/journeys/009). Internal Portal admin only. Blocked (409):
// - any change while a non-cancelled journey's busy window contains now() for that
//   vehicle — the car is mid-trip right now;
// - `inactive` while the car still has upcoming non-cancelled journeys — deactivating a
//   car out from under a booked trip is always a mistake; cancel or reassign them first.
// `on_trip` is never settable: it's derived from journeys at read time, not stored.

import { createClient } from "npm:@supabase/supabase-js@2";
import { requireInternalPortalAdmin, authzErrorResponse } from "../_shared/authz.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SETTABLE_STATUSES = ["vacant", "maintenance", "accidental", "inactive"] as const;
type SettableStatus = (typeof SETTABLE_STATUSES)[number];

interface UpdateCarStatusBody {
  vehicleId: string;
  status: SettableStatus;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    await requireInternalPortalAdmin(supabaseAdmin, supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, req);

    const body = (await req.json()) as Partial<UpdateCarStatusBody>;
    const { vehicleId, status } = body;

    if (!vehicleId || !status) {
      return jsonResponse({ error: "vehicleId and status are required" }, 400);
    }
    if (!SETTABLE_STATUSES.includes(status)) {
      return jsonResponse({ error: `status must be one of ${SETTABLE_STATUSES.join(", ")}` }, 400);
    }

    const nowIso = new Date().toISOString();
    const { data: activeJourney, error: activeError } = await supabaseAdmin
      .from("journeys")
      .select("id, date_from, date_to")
      .eq("vehicle_id", vehicleId)
      .neq("status", "cancelled")
      .lte("first_pickup_at", nowIso)
      .gte("last_drop_at", nowIso)
      .maybeSingle();

    if (activeError) {
      return jsonResponse({ error: activeError.message }, 500);
    }
    if (activeJourney) {
      return jsonResponse(
        { error: "This car is on a journey right now — change its status once the trip ends.", conflict: activeJourney },
        409,
      );
    }

    if (status === "inactive") {
      const { count, error: upcomingError } = await supabaseAdmin
        .from("journeys")
        .select("id", { count: "exact", head: true })
        .eq("vehicle_id", vehicleId)
        .neq("status", "cancelled")
        .gt("first_pickup_at", nowIso);
      if (upcomingError) {
        return jsonResponse({ error: upcomingError.message }, 500);
      }
      if (count && count > 0) {
        return jsonResponse(
          {
            error: `This car has ${count} upcoming ${count === 1 ? "journey" : "journeys"} — cancel or reassign ${count === 1 ? "it" : "them"} before deactivating.`,
          },
          409,
        );
      }
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("vehicles")
      .update({ status })
      .eq("id", vehicleId)
      .select("id, status")
      .maybeSingle();

    if (updateError) {
      return jsonResponse({ error: updateError.message }, 500);
    }
    if (!updated) {
      return jsonResponse({ error: "car not found" }, 404);
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
