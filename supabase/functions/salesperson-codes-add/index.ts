// Self-service: a salesperson adds their own ERP salesperson code(s) to their own
// account, so orders_select (db/orders/010_salesperson_codes_self_service.sql) can
// match them against orders.salesperson_code. Built because there's no reliable way to
// derive a name<->code mapping from the ERP feed — a person typing in their own
// already-known code is the real answer, the same way the pre-Atlas tool at
// ai.jaipurrugs.com/track-jr-order/ already treats a salesperson's login code as
// identical to their ERP salesperson code.
//
// No approval step (explicit product decision, 2026-09-02) — codes take effect
// immediately. The guardrail that DOES exist: this only ever inserts rows for the
// CALLER'S OWN employee_id, resolved from their own session below — never a
// client-supplied id — so self-service can only ever widen your own access, not
// anyone else's. Same "service-role client + authz check in code, not a new RLS write
// policy" pattern as update-own-profile.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AddSalespersonCodesBody {
  codes: string[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "missing Authorization header" }, 401);
    }

    const anonClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const {
      data: { user },
      error: userError,
    } = await anonClient.auth.getUser();
    if (userError || !user) {
      return jsonResponse({ error: "not authenticated" }, 401);
    }

    const { data: employee, error: employeeError } = await supabaseAdmin
      .from("employees")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (employeeError) {
      return jsonResponse({ error: employeeError.message }, 500);
    }
    if (!employee) {
      return jsonResponse({ error: "no employee record for this account" }, 403);
    }

    const body = (await req.json()) as AddSalespersonCodesBody;
    const codes = Array.from(
      new Set((body.codes ?? []).map((c) => c.trim().toUpperCase()).filter((c) => c.length > 0)),
    );
    if (!codes.length) {
      return jsonResponse({ error: "no codes provided" }, 400);
    }

    const { error: insertError } = await supabaseAdmin
      .from("employee_salesperson_codes")
      .upsert(
        codes.map((code) => ({ employee_id: employee.id, salesperson_code: code })),
        { onConflict: "employee_id,salesperson_code", ignoreDuplicates: true },
      );
    if (insertError) {
      return jsonResponse({ error: insertError.message }, 500);
    }

    return jsonResponse({ employeeId: employee.id, added: codes });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "unexpected error" }, 500);
  }
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
