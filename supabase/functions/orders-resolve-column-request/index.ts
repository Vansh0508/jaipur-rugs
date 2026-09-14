// Admin approve/decline for a pending "add this NAV column" request (see
// db/orders/022_column_requests.sql / 023_user_view_preferences_and_request_approval.sql
// and apps/atlas's /my-access "Request a Column" section). Direct request, 2026-09-14:
// there was no real approve action before this — just a plain list Ayaan was expected to
// act on out-of-band. 'approved' records the decision immediately; it is NOT the same as
// 'added' — actually making the field real still needs a schema migration + an
// orders-sync.mjs update + a deploy, which this function does not (and safely cannot)
// do on its own for a live, every-30-minute ERP sync. See 022's header for the full
// reasoning on why that step stays a manual follow-up rather than something a click
// automates.
//
// orders.read.all only (same permission requireAtlasStaffAccess.ts's `isAdmin` already
// checks client-side) — re-verified here, not trusted from the client.

import { createClient } from "npm:@supabase/supabase-js@2";
import { requireAtlasAccess, authzErrorResponse } from "../_shared/authz.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ResolveColumnRequestBody {
  requestId: string;
  decision: "approved" | "declined";
  notes?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const { employeeId } = await requireAtlasAccess(
      supabaseAdmin,
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      req,
      { permissionKey: "orders.read.all" },
    );

    const body = (await req.json()) as Partial<ResolveColumnRequestBody>;
    const { requestId, decision } = body;
    if (!requestId || (decision !== "approved" && decision !== "declined")) {
      return jsonResponse({ error: "requestId and a decision of approved|declined are required" }, 400);
    }
    const notes = body.notes?.trim() || null;

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("orders_column_requests")
      .select("id, status")
      .eq("id", requestId)
      .maybeSingle();
    if (existingError) return jsonResponse({ error: existingError.message }, 500);
    if (!existing) return jsonResponse({ error: "request not found" }, 404);
    if (existing.status !== "pending") {
      return jsonResponse({ error: `request is already ${existing.status}, not pending` }, 409);
    }

    const { error: updateError } = await supabaseAdmin
      .from("orders_column_requests")
      .update({ status: decision, notes, resolved_by: employeeId, resolved_at: new Date().toISOString() })
      .eq("id", requestId);
    if (updateError) return jsonResponse({ error: updateError.message }, 500);

    return jsonResponse({ requestId, status: decision }, 200);
  } catch (err) {
    return authzErrorResponse(err, corsHeaders);
  }
});

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
