// db-management write endpoint: create a new driver. driver_code comes from
// driver_code_seq via the public.next_driver_code() RPC (DB-atomic, race-free — avoids a
// read-MAX-then-+1 race between two concurrent creates). Internal Portal admin only.

import { createClient } from "npm:@supabase/supabase-js@2";
import { requireInternalPortalAdmin, authzErrorResponse } from "../_shared/authz.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateDriverBody {
  fullName: string;
  phone: string;
  departmentId?: string;
  photoPath?: string;
}

const E164_PATTERN = /^\+[1-9]\d{6,14}$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    await requireInternalPortalAdmin(supabaseAdmin, supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, req);

    const body = (await req.json()) as Partial<CreateDriverBody>;
    const fullName = body.fullName?.trim();
    const phone = body.phone?.trim();

    if (!fullName || !phone) {
      return jsonResponse({ error: "fullName and phone are required" }, 400);
    }
    if (!E164_PATTERN.test(phone)) {
      return jsonResponse({ error: "phone must be in E.164 format, e.g. +919812345678" }, 400);
    }

    const { data: driverCode, error: codeError } = await supabaseAdmin.rpc("next_driver_code");
    if (codeError || !driverCode) {
      return jsonResponse({ error: codeError?.message ?? "failed to allocate driver_code" }, 500);
    }

    const { data: created, error: insertError } = await supabaseAdmin
      .from("drivers")
      .insert({
        driver_code: driverCode,
        full_name: fullName,
        phone,
        department_id: body.departmentId ?? null,
        photo_path: body.photoPath ?? null,
      })
      .select("id, driver_code")
      .single();

    if (insertError || !created) {
      return jsonResponse({ error: insertError?.message ?? "insert failed" }, 500);
    }

    return jsonResponse({ id: created.id, driverCode: created.driver_code }, 201);
  } catch (err) {
    return authzErrorResponse(err, corsHeaders);
  }
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
