// db-management endpoint: employee_code alone, matched against the existing `employees`
// row — NOT Supabase Auth. No password, no phone/email, no auth.users row, no session
// created. The app remembers "this browser is employee X" with a plain cookie afterward
// (see lib/authCookies.ts), same mechanism as guest-signup.
//
// Product decision (supersedes the employee_code+phone match and its phone/email
// recovery cascade, see db/MIGRATIONS.md): employees only ever type their code. A code
// that doesn't match an active row is a hard failure — there is no fallback signal left
// to recover from (no phone/email collected here), so this function no longer creates or
// patches any `employees` row. New employees still come from the HR-driven
// `invite-employee`/onboarding flow.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmployeeSignInBody {
  employeeCode: string;
}

const INVALID_MESSAGE = "No active employee matches that employee code.";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as Partial<EmployeeSignInBody>;
    const employeeCode = body.employeeCode?.trim();

    if (!employeeCode) {
      return jsonResponse({ error: "employeeCode is required" }, 400);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Employee codes are stored uppercase (matches the DRV-XXX/driver_code convention) —
    // normalize the input rather than requiring exact-case entry.
    const normalizedCode = employeeCode.toUpperCase();
    const { data: employee, error } = await supabaseAdmin
      .from("employees")
      .select("id, status")
      .eq("employee_code", normalizedCode)
      .maybeSingle();

    if (error) {
      return jsonResponse({ error: error.message }, 500);
    }

    // Same message whether the code doesn't exist or exists but isn't active — don't
    // reveal which case it is.
    if (!employee || employee.status !== "active") {
      return jsonResponse({ error: INVALID_MESSAGE }, 401);
    }

    return jsonResponse({ employeeId: employee.id });
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
