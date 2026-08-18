// db-management write endpoint: upload a driver photo to the `driver-photos` Storage
// bucket (public reads, service-role-only writes — see
// db/feedback/005_create_driver_photos_bucket.sql). No client (anon or authenticated) can
// write to this bucket directly, since no storage.objects RLS policy grants it — this
// function's service-role client is the only way a photo actually lands there. Internal
// Portal admin only, see ../_shared/authz.ts. Returns the object key (`photoPath`) for
// create-driver to store on the `drivers` row — this function does NOT create the driver
// row itself, keeping the two concerns (upload vs. record creation) separate.

import { createClient } from "npm:@supabase/supabase-js@2";
import { requireInternalPortalAdmin, authzErrorResponse } from "../_shared/authz.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DRIVER_PHOTOS_BUCKET = "driver-photos";
const MAX_BYTES = 5 * 1024 * 1024; // 5MB

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    await requireInternalPortalAdmin(supabaseAdmin, supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, req);

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return jsonResponse({ error: "file is required (multipart form field 'file')" }, 400);
    }
    if (!file.type.startsWith("image/")) {
      return jsonResponse({ error: "file must be an image" }, 400);
    }
    if (file.size > MAX_BYTES) {
      return jsonResponse({ error: "file must be 5MB or smaller" }, 400);
    }

    const extension = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
    const path = `${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(DRIVER_PHOTOS_BUCKET)
      .upload(path, await file.arrayBuffer(), { contentType: file.type });

    if (uploadError) {
      return jsonResponse({ error: uploadError.message }, 500);
    }

    return jsonResponse({ photoPath: path }, 201);
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
