// db-management write endpoint: admin pre-seeds a merchant record + the ERP customer
// codes they're allowed to see — replaces hand-editing the old tool's STORE_CUSTOMERS
// JS map. Does NOT create a Clerk account or send any invite email itself (Clerk owns
// that — the merchant simply signs in/up at apps/atlas's merchant login with the same
// email given here); this only creates the row merchants-link-clerk-account will match
// against on that person's first real sign-in. orders.write.all (admin) only.

import { createClient } from "npm:@supabase/supabase-js@2";
import { requireAtlasAccess, authzErrorResponse } from "../_shared/authz.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MerchantsInviteBody {
  displayName: string;
  primaryContactEmail: string;
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

    const body = (await req.json()) as Partial<MerchantsInviteBody>;
    const { displayName, primaryContactEmail, customerNos } = body;
    if (!displayName || !primaryContactEmail || !customerNos?.length) {
      return jsonResponse(
        { error: "displayName, primaryContactEmail, and at least one customerNos entry are required" },
        400,
      );
    }

    const { data: merchant, error: merchantError } = await supabaseAdmin
      .from("merchants")
      .insert({ display_name: displayName, primary_contact_email: primaryContactEmail })
      .select("id")
      .single();
    if (merchantError) {
      // unique index on lower(primary_contact_email) — surface as a clear conflict
      // rather than the raw Postgres constraint message.
      if (merchantError.code === "23505") {
        return jsonResponse({ error: "a merchant with this contact email already exists" }, 409);
      }
      return jsonResponse({ error: merchantError.message }, 500);
    }

    const { error: codesError } = await supabaseAdmin
      .from("merchant_customer_codes")
      .insert(customerNos.map((customerNo) => ({ merchant_id: merchant.id, customer_no: customerNo })));
    if (codesError) return jsonResponse({ error: codesError.message }, 500);

    return jsonResponse({ merchantId: merchant.id }, 200);
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
