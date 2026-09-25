// db-management write endpoint for apps/hub's Settings > Apps row-level "Edit" action.
// Gated by the `apps.manage` permission (see requireEmployeePermission in
// ../_shared/authz.ts).

import { createClient } from "npm:@supabase/supabase-js@2";
import { requireEmployeePermission, authzErrorResponse } from "../_shared/authz.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const KEY_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

interface UpdateAppBody {
  appId: string;
  key?: string;
  name?: string;
  description?: string | null;
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

    const body = (await req.json()) as Partial<UpdateAppBody>;
    if (!body.appId) {
      return jsonResponse({ error: "appId is required" }, 400);
    }
    if (body.key !== undefined && !KEY_PATTERN.test(body.key.trim())) {
      return jsonResponse({ error: "key must be lowercase kebab-case (e.g. \"feedback-app\")" }, 400);
    }

    const update: Record<string, unknown> = {};
    if (body.key !== undefined) update.key = body.key.trim();
    if (body.name !== undefined) update.name = body.name.trim();
    if (body.description !== undefined) update.description = body.description?.trim() || null;
    if (body.isActive !== undefined) update.is_active = body.isActive;

    if (Object.keys(update).length === 0) {
      return jsonResponse({ error: "no fields to update" }, 400);
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("apps")
      .update(update)
      .eq("id", body.appId)
      .select("id")
      .maybeSingle();
    if (updateError) {
      if (updateError.code === "23505") {
        return jsonResponse({ error: "An app with this key already exists." }, 409);
      }
      return jsonResponse({ error: updateError.message }, 500);
    }
    if (!updated) {
      return jsonResponse({ error: "app not found" }, 404);
    }

    return jsonResponse({ appId: updated.id });
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
