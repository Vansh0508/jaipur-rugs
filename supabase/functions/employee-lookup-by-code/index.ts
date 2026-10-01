// Public (verify_jwt = false) — the employee portal's "Employee ID" field: one ACTIVE employee
// by exact employee code, so the booking forms can show "Booking as <name>, <department>"
// before anything is sent. Exact match only (no name search): the portal has no login, so it
// mustn't be a way to browse the employee directory. An inactive or unknown code is a 404
// either way. Returns name, code and department — no phone, email or anything else.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/conference.ts";
import { findActiveEmployeeByCode } from "../_shared/bookingRequests.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const { employeeCode } = (await req.json().catch(() => ({}))) as { employeeCode?: unknown };
    const employee = await findActiveEmployeeByCode(supabaseAdmin, employeeCode);
    if (!employee) {
      return jsonResponse({ error: "No active employee has that employee ID." }, 404);
    }
    return jsonResponse({ employee });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "lookup failed" }, 500);
  }
});
