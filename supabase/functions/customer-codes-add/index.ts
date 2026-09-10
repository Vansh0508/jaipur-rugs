// Self-service: an employee adds one or more ERP customer code(s) (e.g. "24523",
// "34836") to their OWN account, so orders_select / can_view_order (see the
// merchant_customer_codes branch of both) can match them against orders.customer_no.
//
// This is the missing customer-code counterpart to salesperson-codes-add
// (db/orders/010_salesperson_codes_self_service.sql) — that function only ever writes
// to employee_salesperson_codes, so pasting a bare customer number into a "my access"
// flow that calls it silently inserts it as a "salesperson code" that will never match
// orders.salesperson_code — it looks like it "did nothing" (reported 2026-09-10:
// "pasting customer codes like 24523 or 34836 isn't fetching, only SALES-XXXX codes
// work"). The database/RLS side was already correct — orders_select and can_view_order
// already OR in a merchant_customer_codes match (same as the existing merchants flow
// uses) — the gap was simply that no self-service endpoint existed to let an EMPLOYEE
// (as opposed to an external merchant, who already gets rows here via merchants-invite)
// add a row to that table for themselves. This fixes that gap. See
// db/orders/017_backops_department_self_service.sql for the fuller context — this was
// built alongside registering "Back Ops" as a real, self-service department so its
// members can each add exactly the code(s) they need instead of an admin having to
// hand everyone the same bundle.
//
// No approval step, same product posture as salesperson-codes-add and join-department:
// codes take effect immediately, but this only ever inserts rows for the CALLER'S OWN
// employee_id (resolved server-side from their session, never client-supplied) — so
// self-service can only ever widen your own access, never anyone else's.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AddCustomerCodesBody {
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

    const body = (await req.json()) as Partial<AddCustomerCodesBody>;
    // Customer codes are plain ERP numbers (e.g. "24523") — normalized by trimming and
    // stripping leading zeros only, NOT uppercased (unlike salesperson codes, which are
    // alphabetic-prefixed like "SALES-0120"), matching how orders.customer_no / the
    // existing merchant_customer_codes rows are already stored elsewhere in this app.
    const codes = Array.from(
      new Set(
        (body.codes ?? [])
          .map((c) => c.trim().replace(/^0+(?=\d)/, ""))
          .filter((c) => c.length > 0),
      ),
    );
    if (!codes.length) {
      return jsonResponse({ error: "no codes provided" }, 400);
    }

    const { error: insertError } = await supabaseAdmin
      .from("merchant_customer_codes")
      .upsert(
        codes.map((code) => ({ employee_id: employee.id, customer_no: code })),
        { onConflict: "employee_id,customer_no", ignoreDuplicates: true },
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
