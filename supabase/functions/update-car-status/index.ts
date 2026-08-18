// db-management write endpoint: set a car's status to vacant or maintenance. Blocked
// (409) if a non-cancelled journey's busy_window currently contains now() for that
// vehicle — the car is mid-trip right now. Internal Portal admin only.

import { createClient } from "npm:@supabase/supabase-js@2";
import { requireInternalPortalAdmin, authzErrorResponse } from "../_shared/authz.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UpdateCarStatusBody {
  vehicleId: string;
  status: "vacant" | "maintenance";
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
    if (status !== "vacant" && status !== "maintenance") {
      return jsonResponse({ error: "status must be 'vacant' or 'maintenance'" }, 400);
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
        { error: "car is on an active journey right now", conflict: activeJourney },
        409,
      );
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("vehicles")
      .update({ status })
      .eq("id", vehicleId)
      .select("id, status")
      .single();

    if (updateError || !updated) {
      return jsonResponse({ error: updateError?.message ?? "update failed" }, 500);
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
