// db-management write endpoint: climb the REAL named production-escalation chain
// (Yogesh Chaudhary, 2026-08-25) one rung per call — Amit Dagar → Vishal Verma & Sumit
// Yadav → the Director. Per-ORDER, not per-person: self-caps at level 3 with nowhere
// further to go, so no arbitrary rate limit is needed (an earlier per-person-per-week
// design this replaces). Open to any active employee — escalating your own stuck order
// isn't a privileged action.

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
    const body = (await req.json()) as Partial<{ orderId: string; reason: string }>;
    if (!body.orderId) return jsonResponse({ error: "orderId is required" }, 400);

    const { data: order } = await supabaseAdmin.from("orders").select("id").eq("id", body.orderId).maybeSingle();
    if (!order) return jsonResponse({ error: "order not found" }, 404);

    const { data: levels } = await supabaseAdmin.from("escalation_levels").select("level, label").order("level", { ascending: true });
    const { count } = await supabaseAdmin
      .from("order_escalations")
      .select("id", { count: "exact", head: true })
      .eq("order_id", body.orderId);
    const currentCount = count ?? 0;

    if (!levels || currentCount >= levels.length) {
      const top = levels?.[levels.length - 1]?.label ?? "the top level";
      return jsonResponse({ error: `Already escalated to ${top} — top of the chain, nowhere further to go.` }, 409);
    }

    const rung = levels[currentCount];
    const { error: insertError } = await supabaseAdmin.from("order_escalations").insert({
      order_id: body.orderId,
      level: rung.level,
      escalated_by: employeeId,
      reason: body.reason ?? null,
    });
    if (insertError) return jsonResponse({ error: insertError.message }, 500);

    await supabaseAdmin.from("order_events").insert({
      order_id: body.orderId,
      actor_employee_id: employeeId,
      actor_label: "employee",
      action: "escalated",
      snapshot: { level: rung.level, to: rung.label, reason: body.reason ?? null },
    });

    return jsonResponse({
      to: rung.label,
      level: rung.level,
      nextLevel: currentCount + 1 < levels.length ? levels[currentCount + 1].label : null,
    }, 200);
  } catch (err) {
    return authzErrorResponse(err, corsHeaders);
  }
});

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
