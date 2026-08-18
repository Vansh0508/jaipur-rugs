// db-management endpoint: employee_code + phone match against the existing `employees`
// row — NOT Supabase Auth. No password, no auth.users row, no session created. Mirrors
// the guest-signup redesign exactly (see guest-signup/index.ts) — the app remembers
// "this browser is employee X" with a plain cookie afterward, not a session token.
//
// Unlike guest-signup, this never creates a row — employees are pre-existing HR records,
// not something an employee bootstraps for themselves by showing up.
//
// Phone matching is digit-normalized, comparing the last 10 digits only — unlike guests
// (mandatory E.164, multi-country), employees.phone has no enforced format (seeded data
// has bare 10-digit domestic numbers, no country code at all), so an exact string match
// would be fragile against country-code/spacing/dash differences that mean nothing here.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmployeeSignInBody {
  employeeCode: string;
  phone: string;
}

function last10Digits(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as Partial<EmployeeSignInBody>;
    const employeeCode = body.employeeCode?.trim();
    const phone = body.phone?.trim();

    if (!employeeCode || !phone) {
      return jsonResponse({ error: "employeeCode and phone are required" }, 400);
    }

    const inputDigits = last10Digits(phone);
    if (inputDigits.length !== 10) {
      return jsonResponse({ error: "Enter a valid 10-digit phone number." }, 400);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Employee codes are stored uppercase (matches the DRV-XXX/driver_code convention) —
    // normalize the input rather than requiring exact-case entry.
    const { data: employee, error } = await supabaseAdmin
      .from("employees")
      .select("id, status, phone")
      .eq("employee_code", employeeCode.toUpperCase())
      .maybeSingle();

    if (error) {
      return jsonResponse({ error: error.message }, 500);
    }

    const invalidMessage = "No active employee matches that employee code and phone number.";
    if (!employee || employee.status !== "active") {
      return jsonResponse({ error: invalidMessage }, 401);
    }
    if (last10Digits(employee.phone ?? "") !== inputDigits) {
      return jsonResponse({ error: invalidMessage }, 401);
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
