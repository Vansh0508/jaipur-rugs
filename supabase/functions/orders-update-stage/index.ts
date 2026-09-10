// db-management write endpoint: manually correct an order's resolved stage — the rare
// case where status_stage_map hasn't caught up with a new/ambiguous ERP status yet, or
// production needs to flag something the ERP feed doesn't reflect cleanly. Production
// department access or orders.write.all (admin). Every correction is recorded as an
// order_stage_events row with source: 'manual' and recorded_by set — the same table
// orders-sync writes to, so a corrected order's timeline still reads as one continuous
// history, not two disconnected systems.

import { createClient } from "npm:@supabase/supabase-js@2";
import { requireAtlasAccess, authzErrorResponse } from "../_shared/authz.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UpdateStageBody {
  orderId: string;
  stageCode: string;
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
      { permissionKey: "orders.write.all", departmentCodes: ["production"] },
    );

    const body = (await req.json()) as Partial<UpdateStageBody>;
    const { orderId, stageCode } = body;
    if (!orderId || !stageCode) {
      return jsonResponse({ error: "orderId and stageCode are required" }, 400);
    }

    const { data: stage, error: stageError } = await supabaseAdmin
      .from("stages")
      .select("id")
      .eq("code", stageCode)
      .maybeSingle();
    if (stageError) return jsonResponse({ error: stageError.message }, 500);
    if (!stage) return jsonResponse({ error: `unknown stage code: ${stageCode}` }, 400);

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id")
      .eq("id", orderId)
      .maybeSingle();
    if (orderError) return jsonResponse({ error: orderError.message }, 500);
    if (!order) return jsonResponse({ error: "order not found" }, 404);

    const nowIso = new Date().toISOString();

    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update({ stage_id: stage.id, updated_at: nowIso })
      .eq("id", orderId);
    if (updateError) return jsonResponse({ error: updateError.message }, 500);

    const { error: eventError } = await supabaseAdmin.from("order_stage_events").upsert(
      {
        order_id: orderId,
        stage_id: stage.id,
        entered_at: nowIso,
        source: "manual",
        recorded_by: employeeId,
      },
      { onConflict: "order_id,stage_id,entered_at", ignoreDuplicates: true },
    );
    if (eventError) return jsonResponse({ error: eventError.message }, 500);

    return jsonResponse({ orderId, stageCode }, 200);
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
