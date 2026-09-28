// db-management write endpoint: set a driver's status — active, on_leave, suspended, or
// inactive (soft-delete; db/journeys/009). The driver-side counterpart of
// update-car-status, same guards. Internal Portal admin only. Blocked (409):
// - any status other than `active` while the driver is mid-trip right now;
// - `inactive` while the driver still has upcoming non-cancelled journeys.
// on_leave/suspended with upcoming journeys is allowed on purpose (a short leave may end
// before the trip); the new-journey driver picker only offers `active` drivers either way.

import { createClient } from "npm:@supabase/supabase-js@2";
import { requireInternalPortalAdmin, authzErrorResponse } from "../_shared/authz.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SETTABLE_STATUSES = ["active", "on_leave", "suspended", "inactive"] as const;
type SettableStatus = (typeof SETTABLE_STATUSES)[number];

interface UpdateDriverStatusBody {
  driverId: string;
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

    const body = (await req.json()) as Partial<UpdateDriverStatusBody>;
    const { driverId, status } = body;

    if (!driverId || !status) {
      return jsonResponse({ error: "driverId and status are required" }, 400);
    }
    if (!SETTABLE_STATUSES.includes(status)) {
      return jsonResponse({ error: `status must be one of ${SETTABLE_STATUSES.join(", ")}` }, 400);
    }

    const nowIso = new Date().toISOString();

    if (status !== "active") {
      const { data: activeJourney, error: activeError } = await supabaseAdmin
        .from("journeys")
        .select("id, date_from, date_to")
        .eq("driver_id", driverId)
        .neq("status", "cancelled")
        .lte("first_pickup_at", nowIso)
        .gte("last_drop_at", nowIso)
        .maybeSingle();
      if (activeError) {
        return jsonResponse({ error: activeError.message }, 500);
      }
      if (activeJourney) {
        return jsonResponse(
          { error: "This driver is on a journey right now — change their status once the trip ends.", conflict: activeJourney },
          409,
        );
      }
    }

    if (status === "inactive") {
      const { count, error: upcomingError } = await supabaseAdmin
        .from("journeys")
        .select("id", { count: "exact", head: true })
        .eq("driver_id", driverId)
        .neq("status", "cancelled")
        .gt("first_pickup_at", nowIso);
      if (upcomingError) {
        return jsonResponse({ error: upcomingError.message }, 500);
      }
      if (count && count > 0) {
        return jsonResponse(
          {
            error: `This driver has ${count} upcoming ${count === 1 ? "journey" : "journeys"} — cancel or reassign ${count === 1 ? "it" : "them"} before deactivating.`,
          },
          409,
        );
      }
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("drivers")
      .update({ status })
      .eq("id", driverId)
      .select("id, status")
      .maybeSingle();

    if (updateError) {
      return jsonResponse({ error: updateError.message }, 500);
    }
    if (!updated) {
      return jsonResponse({ error: "driver not found" }, 404);
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
