// db-management write endpoint: cancel a journey. Plain single-table update (no SQL
// function needed — unlike create/update, this doesn't touch guests/stops or need
// transactional multi-table atomicity). Cancelling frees the vehicle_id/driver_id
// EXCLUDE constraints' overlap check immediately, since both only apply `where status <>
// 'cancelled'`. Internal Portal admin only, see ../_shared/authz.ts.

import { createClient } from "npm:@supabase/supabase-js@2";
import { requireInternalPortalAdmin, authzErrorResponse } from "../_shared/authz.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CancelJourneyBody {
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

    const body = (await req.json()) as Partial<CancelJourneyBody>;
    if (!body.journeyId) {
      return jsonResponse({ error: "journeyId is required" }, 400);
    }

    const { data: updated, error } = await supabaseAdmin
      .from("journeys")
      .update({ status: "cancelled" })
      .eq("id", body.journeyId)
      .neq("status", "completed")
      .select("id, status")
      .maybeSingle();

    if (error) {
      return jsonResponse({ error: error.message }, 500);
    }
    if (!updated) {
      return jsonResponse({ error: "journey not found, or already completed" }, 404);
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
