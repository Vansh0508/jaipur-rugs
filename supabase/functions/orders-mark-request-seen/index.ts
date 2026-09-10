// db-management write endpoint: record a "seen" receipt on a work request — kills the
// "maine dekha nahi" (I never saw it) excuse. Open to any active employee (seeing
// something isn't a privileged action); one row per (request, viewer), idempotent.

import { createClient } from "npm:@supabase/supabase-js@2";
import { requireActiveEmployee, authzErrorResponse } from "../_shared/authz.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const { employeeId } = await requireActiveEmployee(supabaseAdmin, supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, req);
    const body = (await req.json()) as Partial<{ requestId: string }>;
    if (!body.requestId) return jsonResponse({ error: "requestId is required" }, 400);

    const { data: request } = await supabaseAdmin.from("order_requests").select("id, order_id").eq("id", body.requestId).maybeSingle();
    if (!request) return jsonResponse({ error: "request not found" }, 404);

    const { error } = await supabaseAdmin
      .from("order_request_seen")
      .upsert({ request_id: body.requestId, employee_id: employeeId }, { onConflict: "request_id,employee_id", ignoreDuplicates: true });
    if (error) return jsonResponse({ error: error.message }, 500);

    await supabaseAdmin.from("order_events").insert({
      order_id: request.order_id,
      actor_employee_id: employeeId,
      actor_label: "employee",
      action: "request_seen",
      snapshot: { requestId: body.requestId },
    });

    return jsonResponse({ ok: true }, 200);
  } catch (err) {
    return authzErrorResponse(err, corsHeaders);
  }
});

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
