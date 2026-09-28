// db-management write endpoint: edit a driver's details (name, phone, photo). driver_code
// is never editable (server-allocated from driver_code_seq, see create-driver). Status is
// NOT editable here; that's update-driver-status, which carries the trip guards. Internal
// Portal admin only.
//
// photoPath: omitted → keep the current photo; a string → the new object key returned by
// upload-driver-photo; null → remove the photo. The previous object is left in the
// driver-photos bucket (not deleted) — harmless, and never deleting means a failed save
// can't strand a driver pointing at a photo that no longer exists.

import { createClient } from "npm:@supabase/supabase-js@2";
import { requireInternalPortalAdmin, authzErrorResponse } from "../_shared/authz.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UpdateDriverBody {
  driverId: string;
  fullName: string;
  phone: string;
  photoPath?: string | null;
}

// Same rule as create-driver and the drivers_phone_e164 CHECK constraint.
const E164_PATTERN = /^\+[1-9]\d{6,14}$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    await requireInternalPortalAdmin(supabaseAdmin, supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, req);

    const body = (await req.json()) as Partial<UpdateDriverBody>;
    const driverId = body.driverId;
    const fullName = body.fullName?.trim();
    const phone = body.phone?.trim();

    if (!driverId || !fullName || !phone) {
      return jsonResponse({ error: "driverId, fullName, and phone are required" }, 400);
    }
    if (!E164_PATTERN.test(phone)) {
      return jsonResponse({ error: "phone must be in E.164 format, e.g. +919812345678" }, 400);
    }

    const changes: Record<string, string | null> = { full_name: fullName, phone };
    if (body.photoPath !== undefined) {
      changes.photo_path = body.photoPath;
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("drivers")
      .update(changes)
      .eq("id", driverId)
      .select("id")
      .maybeSingle();

    if (updateError) {
      return jsonResponse({ error: updateError.message }, 500);
    }
    if (!updated) {
      return jsonResponse({ error: "driver not found" }, 404);
    }

    return jsonResponse({ id: updated.id });
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
