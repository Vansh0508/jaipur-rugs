// Self-service: at sign-up, a person picks "Management" or "Production" and gets a
// department_access_grants row on their OWN account for it — same posture as
// salesperson-codes-add (db/orders/010, supabase/functions/salesperson-codes-add): no
// approval step, explicit product decision (2026-09-05) — but always at access_level
// 'view' (never 'manage'/'admin') and always for the CALLER'S OWN employee_id, resolved
// server-side from their session, never a client-supplied id.
//
// Only "management" and "production" are allowed here — NOT "sales" (that department
// code means blanket view-all, per private.has_blanket_orders_access(); an individual
// salesperson must stay scoped to their own employee_salesperson_codes rows instead, or
// this would silently hand them everyone's orders) and NOT "nav"/"qc"/"shipping"
// ("will come in later stage", per the same product decision — not self-service yet).

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SELF_SERVICE_DEPARTMENT_CODES = ["management", "production"] as const;
type SelfServiceDepartmentCode = (typeof SELF_SERVICE_DEPARTMENT_CODES)[number];

interface JoinDepartmentBody {
  departmentCode: string;
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

    const body = (await req.json()) as Partial<JoinDepartmentBody>;
    const departmentCode = body.departmentCode;
    if (!SELF_SERVICE_DEPARTMENT_CODES.includes(departmentCode as SelfServiceDepartmentCode)) {
      return jsonResponse({ error: `departmentCode must be one of: ${SELF_SERVICE_DEPARTMENT_CODES.join(", ")}` }, 400);
    }

    const { data: department, error: deptError } = await supabaseAdmin
      .from("departments")
      .select("id")
      .eq("code", departmentCode)
      .single();
    if (deptError || !department) {
      return jsonResponse({ error: deptError?.message ?? "department not found" }, 500);
    }

    const { error: insertError } = await supabaseAdmin
      .from("department_access_grants")
      .upsert(
        { employee_id: employee.id, department_id: department.id, access_level: "view" },
        { onConflict: "employee_id,department_id", ignoreDuplicates: true },
      );
    if (insertError) {
      return jsonResponse({ error: insertError.message }, 500);
    }

    return jsonResponse({ employeeId: employee.id, departmentCode });
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
