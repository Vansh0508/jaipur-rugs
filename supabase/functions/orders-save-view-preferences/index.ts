// Self-service: saves the CALLER'S OWN Orders table view preferences (which columns are
// shown, their order, which filters are hidden, row height) so they follow the account,
// not the browser. Direct request, 2026-09-14: "lock the user's view acc to their user
// id so from any system the user logs in he will view his own personalized view only" —
// these used to live in localStorage (apps/atlas/lib/useLocalPreference.ts), which is
// per-device, not per-account. See db/orders/023_user_view_preferences_and_request_approval.sql.
//
// Same "service-role client + authz check in code, always the CALLER'S OWN employee_id,
// never client-supplied" pattern as salesperson-codes-add/orders-request-column — no
// approval needed, takes effect immediately (this is UI preference, not order data).
//
// Every field is optional and only the ones present are changed (a partial update,
// upserted against whatever's already stored) — so toggling one column's visibility
// doesn't require re-sending the whole preference set every time.

import { createClient } from "npm:@supabase/supabase-js@2";
import { requireActiveEmployee, authzErrorResponse } from "../_shared/authz.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SaveViewPreferencesBody {
  hiddenColumns?: string[];
  columnOrder?: string[];
  hiddenFilters?: string[];
  rowHeight?: "compact" | "normal" | "comfortable";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const { employeeId } = await requireActiveEmployee(
      supabaseAdmin,
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      req,
    );

    const body = (await req.json()) as SaveViewPreferencesBody;

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("user_orders_view_preferences")
      .select("hidden_columns, column_order, hidden_filters, row_height")
      .eq("employee_id", employeeId)
      .maybeSingle();
    if (existingError) return jsonResponse({ error: existingError.message }, 500);

    const merged = {
      employee_id: employeeId,
      hidden_columns: body.hiddenColumns ?? existing?.hidden_columns ?? [],
      column_order: body.columnOrder ?? existing?.column_order ?? [],
      hidden_filters: body.hiddenFilters ?? existing?.hidden_filters ?? [],
      row_height: body.rowHeight ?? existing?.row_height ?? "normal",
      updated_at: new Date().toISOString(),
    };

    const { error: upsertError } = await supabaseAdmin
      .from("user_orders_view_preferences")
      .upsert(merged, { onConflict: "employee_id" });
    if (upsertError) return jsonResponse({ error: upsertError.message }, 500);

    return jsonResponse({ employeeId }, 200);
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
