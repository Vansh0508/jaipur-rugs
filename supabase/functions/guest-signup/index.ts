// db-management write endpoint: guest phone-match-or-create, pure data entry — NOT
// Supabase Auth user creation. Guests never get an auth.users row or a session at all
// (explicit product decision). If the phone number matches an existing guests row, that
// row is reused (name refreshed in case it changed); otherwise a new row is created.
// Either way the caller gets back a guestId, which the app remembers client-side (a plain
// cookie, not a session) to identify "this browser is guest X" on later requests.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GuestSignUpBody {
  fullName: string;
  phone: string;
}

const E164_PATTERN = /^\+[1-9]\d{6,14}$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as Partial<GuestSignUpBody>;
    const fullName = body.fullName?.trim();
    const phone = body.phone?.trim();

    if (!fullName || !phone) {
      return jsonResponse({ error: "fullName and phone are required" }, 400);
    }
    if (!E164_PATTERN.test(phone)) {
      return jsonResponse({ error: "phone must be in E.164 format, e.g. +919812345678" }, 400);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: existingGuest, error: lookupError } = await supabaseAdmin
      .from("guests")
      .select("id")
      .eq("phone", phone)
      .maybeSingle();

    if (lookupError) {
      return jsonResponse({ error: lookupError.message }, 500);
    }

    if (existingGuest) {
      const { error: updateError } = await supabaseAdmin
        .from("guests")
        .update({ full_name: fullName, updated_at: new Date().toISOString() })
        .eq("id", existingGuest.id);
      if (updateError) {
        return jsonResponse({ error: updateError.message }, 500);
      }
      return jsonResponse({ guestId: existingGuest.id, matched: true });
    }

    const { data: created, error: insertError } = await supabaseAdmin
      .from("guests")
      .insert({ full_name: fullName, phone })
      .select("id")
      .single();

    if (insertError || !created) {
      return jsonResponse({ error: insertError?.message ?? "insert failed" }, 500);
    }

    return jsonResponse({ guestId: created.id, matched: false });
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
