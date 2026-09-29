// db-management endpoint: bumps last_heartbeat_at on the caller's own OPEN session.
// Self-service, always the CALLER'S OWN account — the sessionId is only ever accepted if
// it actually belongs to the caller (auth_user_id match) and isn't already ended;
// otherwise this returns 404 so the client knows to call login-sessions-start again for a
// fresh session id (e.g. after being idle long enough for something else to have ended
// it, or a stale sessionId from a previous browser session).

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface HeartbeatBody {
  sessionId: string;
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

    const body = (await req.json()) as Partial<HeartbeatBody>;
    if (!body.sessionId) {
      return jsonResponse({ error: "sessionId is required" }, 400);
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("login_sessions")
      .update({ last_heartbeat_at: new Date().toISOString() })
      .eq("id", body.sessionId)
      .eq("auth_user_id", user.id)
      .is("ended_at", null)
      .select("id")
      .maybeSingle();
    if (updateError) {
      return jsonResponse({ error: updateError.message }, 500);
    }
    if (!updated) {
      return jsonResponse({ error: "session not found, not yours, or already ended" }, 404);
    }

    return jsonResponse({ sessionId: updated.id });
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
