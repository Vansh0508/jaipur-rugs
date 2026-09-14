// Column-request self-service: an employee requests one specific NAV field (from the
// full catalog in apps/atlas/lib/requestableNavFields.ts — verified real against the
// live NAV-002 view, see db/orders/021_nav_full_field_expansion.sql's header) that
// isn't in Atlas's `orders` table yet. Direct decision, 2026-09-12: rather than add all
// 180 candidate fields up front (a bigger migration + a heavier orders-sync.mjs pull for
// fields most people never look at), a request lands in orders_column_requests for
// Ayaan to review, and only the ones actually wanted get added, one at a time.
//
// Same "service-role client + authz check in code, requested_by always the CALLER'S OWN
// employee_id, never client-supplied" pattern as salesperson-codes-add/
// customer-codes-add — self-service can only ever create a request under your own name,
// never impersonate someone else's.
//
// No approval needed to CREATE a request (any authenticated Atlas staff member can ask)
// — the gate is on Ayaan's side (only he actually adds the column), not here.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestColumnBody {
  navFieldName: string;
  notes?: string;
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

    const body = (await req.json()) as RequestColumnBody;
    const navFieldName = body.navFieldName?.trim();
    if (!navFieldName) {
      return jsonResponse({ error: "navFieldName is required" }, 400);
    }
    const notes = body.notes?.trim() || null;

    // Same field, still pending, already requested by this exact person — don't pile up
    // duplicate rows every time they reopen the "Request a column" list.
    const { data: existing, error: existingError } = await supabaseAdmin
      .from("orders_column_requests")
      .select("id")
      .eq("nav_field_name", navFieldName)
      .eq("requested_by", employee.id)
      .eq("status", "pending")
      .maybeSingle();
    if (existingError) {
      return jsonResponse({ error: existingError.message }, 500);
    }
    if (existing) {
      return jsonResponse({ id: existing.id, alreadyRequested: true });
    }

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("orders_column_requests")
      .insert({ nav_field_name: navFieldName, requested_by: employee.id, notes })
      .select("id")
      .single();
    if (insertError) {
      return jsonResponse({ error: insertError.message }, 500);
    }

    return jsonResponse({ id: inserted.id, alreadyRequested: false });
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
