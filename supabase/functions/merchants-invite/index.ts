// db-management write endpoint: admin grants an EXISTING employee visibility into
// specific ERP customer codes. "Merchant" in this business's own vocabulary means a
// territory head/B2B salesperson — not an external customer (Ayaan's correction,
// 2026-09-01, which is also why this no longer creates a separate Clerk-linkable
// `merchants` row — that whole system is gone, consolidated onto Supabase Auth like
// every other employee). Kept the function's original name/slug to avoid an extra
// redeploy-and-repoint; only its body changed.
//
// Does NOT create the employee account — the salesperson signs up once via the normal
// employee-signup flow first, same as any other staff member; this only grants access
// once that account exists. orders.write.all (admin) only.

import { createClient } from "npm:@supabase/supabase-js@2";
import { requireAtlasAccess, authzErrorResponse } from "../_shared/authz.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GrantCustomerCodesBody {
  employeeEmail: string;
  customerNos: string[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    await requireAtlasAccess(supabaseAdmin, supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, req, {
      permissionKey: "orders.write.all",
    });

    const body = (await req.json()) as Partial<GrantCustomerCodesBody>;
    const employeeEmail = body.employeeEmail?.trim().toLowerCase();
    const customerNos = body.customerNos;
    if (!employeeEmail || !customerNos?.length) {
      return jsonResponse({ error: "employeeEmail and at least one customerNos entry are required" }, 400);
    }

    const { data: employee, error: employeeError } = await supabaseAdmin
      .from("employees")
      .select("id, status")
      .ilike("email", employeeEmail)
      .maybeSingle();
    if (employeeError) return jsonResponse({ error: employeeError.message }, 500);
    if (!employee) {
      return jsonResponse(
        { error: "No employee account for this email yet — they need to sign up via Hub/employee-signup first, then grant access." },
        404,
      );
    }

    const { data: inserted, error: codesError } = await supabaseAdmin
      .from("merchant_customer_codes")
      .upsert(
        customerNos.map((customerNo) => ({ employee_id: employee.id, customer_no: customerNo })),
        { onConflict: "employee_id,customer_no", ignoreDuplicates: true },
      )
      .select("id");
    if (codesError) return jsonResponse({ error: codesError.message }, 500);

    return jsonResponse({ employeeId: employee.id, granted: inserted?.length ?? 0 }, 200);
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
