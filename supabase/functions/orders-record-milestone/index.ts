// db-management write endpoint: record a lifecycle milestone ERP can't see (dispatched,
// awb_issued — qc_done/packed are normally set automatically by orders-action-request
// when their request is marked done, but this covers a direct record too). Open to any
// active employee holding production/shipping/nav access, or orders.write.all (admin).
//
// For awb_issued, `note` IS the AWB number — the order detail's tracking link is
// generated from it, not a free-text comment.

import { createClient } from "npm:@supabase/supabase-js@2";
import { requireAtlasAccess, authzErrorResponse } from "../_shared/authz.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VALID_KEYS = ["qc_done", "packed", "dispatched", "awb_issued"] as const;

interface RecordMilestoneBody {
  orderId: string;
  milestone: (typeof VALID_KEYS)[number];
  note?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const { employeeId } = await requireAtlasAccess(supabaseAdmin, supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, req, {
      permissionKey: "orders.write.all",
      departmentCodes: ["production", "shipping", "nav"],
    });

    const body = (await req.json()) as Partial<RecordMilestoneBody>;
    if (!body.orderId || !VALID_KEYS.includes(body.milestone as never)) {
      return jsonResponse({ error: "orderId and a valid milestone key are required" }, 400);
    }
    if (body.milestone === "awb_issued" && !body.note) {
      return jsonResponse({ error: "AWB number is required (passed as note) — the tracking link is generated from it." }, 400);
    }

    const { data: order } = await supabaseAdmin.from("orders").select("id").eq("id", body.orderId).maybeSingle();
    if (!order) return jsonResponse({ error: "order not found" }, 404);

    const { error } = await supabaseAdmin
      .from("order_milestones")
      .upsert(
        { order_id: body.orderId, milestone: body.milestone, recorded_by: employeeId, note: body.note ?? null },
        { onConflict: "order_id,milestone" },
      );
    if (error) return jsonResponse({ error: error.message }, 500);

    await supabaseAdmin.from("order_events").insert({
      order_id: body.orderId,
      actor_employee_id: employeeId,
      actor_label: "employee",
      action: `milestone_${body.milestone}`,
      snapshot: { note: body.note ?? null },
    });

    return jsonResponse({ ok: true }, 200);
  } catch (err) {
    return authzErrorResponse(err, corsHeaders);
  }
});

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
