// db-management write endpoint: upload the caller's own avatar to the `employee-avatars`
// Storage bucket (public reads, service-role-only writes — see
// db/team-members/006_hub_onboarding_and_admin.sql). Mirrors upload-driver-photo exactly,
// except the auth check is "any authenticated employee" rather than an Internal Portal
// admin gate — this is a self-service upload, used from the onboarding wizard's photo step
// and from /profile. Returns the object key (`avatarPath`) for update-own-profile to store.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EMPLOYEE_AVATARS_BUCKET = "employee-avatars";
const MAX_BYTES = 5 * 1024 * 1024; // 5MB

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
      .from(EMPLOYEE_AVATARS_BUCKET)
      .upload(path, await file.arrayBuffer(), { contentType: file.type });
    if (uploadError) {
      return jsonResponse({ error: uploadError.message }, 500);
    }

    return jsonResponse({ avatarPath: path }, 201);
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
