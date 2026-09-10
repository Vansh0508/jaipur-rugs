// db-management write endpoint: file a work request (order punch / create warehouse /
// post warehouse / QC review) into the owning department's queue — the structured
// replacement for the order@/mzpreview@ email relay (see db/orders/004's header
// comment and the Milan-folder analysis it cites). Open to any active employee, not
// department-gated — filing is the write-side equivalent of "anyone can send an
// email today" (requireActiveEmployee); ACTIONING a request is what checks department
// access (orders-action-request).
//
// PSFT is requester-supplied here, not a separate approval step — there is no accounts
// department in Atlas (corrected 2026-08-25). Required for create_warehouse.

import { createClient } from "npm:@supabase/supabase-js@2";
import { requireActiveEmployee, authzErrorResponse } from "../_shared/authz.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateRequestBody {
  orderId: string;
  requestTypeCode: string;
  psft?: string;
  note?: string;
}

function qcLocationLabel(rawStatus: string | null): string {
  return /mirzapur|mzp/i.test(rawStatus ?? "") ? "Mirzapur (mzpreview@)" : "HO (carpet.r@)";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const { employeeId } = await requireActiveEmployee(supabaseAdmin, supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, req);

    const body = (await req.json()) as Partial<CreateRequestBody>;
    const { orderId, requestTypeCode } = body;
    if (!orderId || !requestTypeCode) {
      return jsonResponse({ error: "orderId and requestTypeCode are required" }, 400);
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id, raw_current_status, item_no, customer_no, quality, design, gr_color_name, br_color_name, size, shape, std_cubage, serial_no, sales_order_no")
      .eq("id", orderId)
      .maybeSingle();
    if (orderError) return jsonResponse({ error: orderError.message }, 500);
    if (!order) return jsonResponse({ error: "order not found" }, 404);

    const { data: requestType, error: typeError } = await supabaseAdmin
      .from("request_types")
      .select("id, code, owning_department_code, location_dependent")
      .eq("code", requestTypeCode)
      .maybeSingle();
    if (typeError) return jsonResponse({ error: typeError.message }, 500);
    if (!requestType) return jsonResponse({ error: `unknown requestTypeCode: ${requestTypeCode}` }, 400);

    // PSFT: required at create_warehouse, optional at process_order, carried into
    // post_warehouse from whatever create_warehouse already recorded.
    let psft = body.psft ?? null;
    let blockedReason: string | null = null;
    let warehouseNo: string | null = null;

    if (requestType.code === "create_warehouse" && !psft) {
      return jsonResponse(
        { error: "PSFT is required to create a warehouse — include it with the request (e.g. 0.75 GBP)." },
        400,
      );
    }

    if (requestType.code === "post_warehouse") {
      const { data: createType } = await supabaseAdmin.from("request_types").select("id").eq("code", "create_warehouse").single();
      const { data: createReq } = await supabaseAdmin
        .from("order_requests")
        .select("warehouse_no, psft")
        .eq("order_id", orderId)
        .eq("request_type_id", createType?.id ?? "")
        .eq("status", "done")
        .order("actioned_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (createReq?.warehouse_no) {
        warehouseNo = createReq.warehouse_no;
        psft = psft ?? createReq.psft ?? null;
      } else {
        blockedReason = "Warehouse No (create warehouse first)";
      }
    }

    const { data: request, error: insertError } = await supabaseAdmin
      .from("order_requests")
      .insert({
        order_id: orderId,
        request_type_id: requestType.id,
        status: blockedReason ? "blocked" : "open",
        blocked_reason: blockedReason,
        psft,
        warehouse_no: warehouseNo,
        note: body.note ?? null,
        requested_by: employeeId,
      })
      .select("id, status, blocked_reason, psft, warehouse_no, created_at")
      .single();
    if (insertError) return jsonResponse({ error: insertError.message }, 500);

    await supabaseAdmin.from("order_events").insert({
      order_id: orderId,
      actor_employee_id: employeeId,
      actor_label: "employee",
      action: "request_filed",
      snapshot: { requestId: request.id, type: requestType.code, blocked: Boolean(blockedReason) },
    });

    return jsonResponse({
      request,
      qcLocation: requestType.location_dependent ? qcLocationLabel(order.raw_current_status) : null,
    }, 200);
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
