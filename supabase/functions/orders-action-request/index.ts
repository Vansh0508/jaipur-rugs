// db-management write endpoint: action a work request — done/in_progress/rejected.
// Gated by the request TYPE's owning department (requireAtlasAccess), or
// orders.write.all (admin). Enforces the ack-is-the-number rule verified against real
// email threads: order punch needs its SO no., create_warehouse needs its Warehouse
// No, before either can be marked done. A landed Warehouse No auto-unblocks any
// post_warehouse request on the same order and fills its column — the manual
// re-sequencing the emails required disappears here.

import { createClient } from "npm:@supabase/supabase-js@2";
import { requireAtlasAccess, authzErrorResponse } from "../_shared/authz.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ActionRequestBody {
  requestId: string;
  status: "in_progress" | "done" | "rejected";
  soNo?: string;
  warehouseNo?: string;
  note?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const body = (await req.json()) as Partial<ActionRequestBody>;
    const { requestId, status } = body;
    if (!requestId || !["in_progress", "done", "rejected"].includes(status ?? "")) {
      return jsonResponse({ error: "requestId and a valid status are required" }, 400);
    }

    const { data: request, error: reqError } = await supabaseAdmin
      .from("order_requests")
      .select("id, order_id, status, request_type_id, request_types(code, owning_department_code)")
      .eq("id", requestId)
      .maybeSingle();
    if (reqError) return jsonResponse({ error: reqError.message }, 500);
    if (!request) return jsonResponse({ error: "request not found" }, 404);

    const typeCode = (request.request_types as unknown as { code: string; owning_department_code: string }).code;
    const owningDept = (request.request_types as unknown as { code: string; owning_department_code: string }).owning_department_code;

    const { employeeId } = await requireAtlasAccess(supabaseAdmin, supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, req, {
      permissionKey: "orders.write.all",
      departmentCodes: [owningDept],
    });

    if (request.status === "blocked" && status !== "rejected") {
      return jsonResponse({ error: "This request is blocked on a dependency — action that first; this one unblocks itself." }, 409);
    }
    if (typeCode === "process_order" && status === "done" && !body.soNo) {
      return jsonResponse({ error: "Enter the SO number (e.g. JR/SO/2627/04237) — the punch confirmation IS the number." }, 400);
    }
    if (typeCode === "create_warehouse" && status === "done" && !body.warehouseNo) {
      return jsonResponse({ error: "Enter the Warehouse No (e.g. JR/PL-MZ-22982) — it's the reference everyone uses from packing to shipping." }, 400);
    }

    const nowIso = new Date().toISOString();
    const update: Record<string, unknown> = { status, actioned_by: employeeId, actioned_at: nowIso };
    if (body.note) update.note = body.note;
    if (body.soNo) update.so_no = body.soNo;
    if (body.warehouseNo) update.warehouse_no = body.warehouseNo;

    const { error: updateError } = await supabaseAdmin.from("order_requests").update(update).eq("id", requestId);
    if (updateError) return jsonResponse({ error: updateError.message }, 500);

    await supabaseAdmin.from("order_events").insert({
      order_id: request.order_id,
      actor_employee_id: employeeId,
      actor_label: "employee",
      action: `request_${status}`,
      snapshot: { requestId, type: typeCode, soNo: body.soNo, warehouseNo: body.warehouseNo, note: body.note },
    });

    // A completed request IS a milestone for post_warehouse/qc_review — no double entry.
    if (status === "done") {
      const milestoneKey = typeCode === "post_warehouse" ? "packed" : typeCode === "qc_review" ? "qc_done" : null;
      if (milestoneKey) {
        await supabaseAdmin
          .from("order_milestones")
          .upsert({ order_id: request.order_id, milestone: milestoneKey, recorded_by: employeeId }, { onConflict: "order_id,milestone", ignoreDuplicates: true });
      }
    }

    // Auto-unblock: a landed Warehouse No fills and opens any waiting post_warehouse
    // request on the same order.
    if (typeCode === "create_warehouse" && status === "done" && body.warehouseNo) {
      const { data: blocked } = await supabaseAdmin
        .from("order_requests")
        .select("id, request_types(code)")
        .eq("order_id", request.order_id)
        .eq("status", "blocked");
      for (const b of blocked ?? []) {
        if ((b.request_types as unknown as { code: string }).code !== "post_warehouse") continue;
        await supabaseAdmin
          .from("order_requests")
          .update({ status: "open", blocked_reason: null, warehouse_no: body.warehouseNo })
          .eq("id", b.id);
        await supabaseAdmin.from("order_events").insert({
          order_id: request.order_id,
          actor_label: "Atlas (system)",
          action: "request_unblocked",
          snapshot: { requestId: b.id, warehouseNo: body.warehouseNo },
        });
      }
    }

    return jsonResponse({ requestId, status }, 200);
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
