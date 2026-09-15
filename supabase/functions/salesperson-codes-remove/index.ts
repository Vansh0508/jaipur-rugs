// Self-service counterpart to salesperson-codes-add: lets an employee remove a
// sales code they added to their OWN account by mistake. Until this existed there was
// no way to undo a wrong entry at all (reported 2026-09-15, Pranjal Jain's account —
// a code added as a workaround stayed stuck forever with no way to clear it). Same
// posture as the add function: employee_id is always resolved server-side from the
// caller's own session, never client-supplied, so this can only ever narrow the
// caller's own access, never anyone else's.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RemoveSalespersonCodeBody {
  code: string;
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

    const body = (await req.json()) as Partial<RemoveSalespersonCodeBody>;
    const code = body.code?.trim().toUpperCase();
    if (!code) {
      return jsonResponse({ error: "no code provided" }, 400);
    }

    const { error: deleteError } = await supabaseAdmin
      .from("employee_salesperson_codes")
      .delete()
      .eq("employee_id", employee.id)
      .eq("salesperson_code", code);
    if (deleteError) {
      return jsonResponse({ error: deleteError.message }, 500);
    }

    return jsonResponse({ employeeId: employee.id, removed: code });
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
