// db-management write endpoint for apps/hub's Settings > Apps "Add app" action. Gated by
// the `apps.manage` permission (see requireEmployeePermission in ../_shared/authz.ts). The
// `key` is metadata only (should match an apps/<key> folder name per
// db/team-members/001_team_members_schema.sql's comment) — this function can't verify that
// from a Deno edge function, so it only checks the key's shape.

import { createClient } from "npm:@supabase/supabase-js@2";
import { requireEmployeePermission, authzErrorResponse } from "../_shared/authz.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const KEY_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

interface CreateAppBody {
  key: string;
  name: string;
  description?: string;
  isActive?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    await requireEmployeePermission(supabaseAdmin, supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, req, "apps.manage");

    const body = (await req.json()) as Partial<CreateAppBody>;
    const key = body.key?.trim();
    const name = body.name?.trim();

    if (!key || !name) {
      return jsonResponse({ error: "key and name are required" }, 400);
    }
    if (!KEY_PATTERN.test(key)) {
      return jsonResponse({ error: "key must be lowercase kebab-case (e.g. \"feedback-app\")" }, 400);
    }

    const { data: created, error: insertError } = await supabaseAdmin
      .from("apps")
      .insert({
        key,
        name,
        description: body.description?.trim() || null,
        is_active: body.isActive ?? true,
      })
      .select("id")
      .single();
    if (insertError) {
      if (insertError.code === "23505") {
        return jsonResponse({ error: "An app with this key already exists." }, 409);
      }
      return jsonResponse({ error: insertError.message }, 500);
    }
    if (!created) {
      return jsonResponse({ error: "insert failed" }, 500);
    }

    return jsonResponse({ appId: created.id }, 201);
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
