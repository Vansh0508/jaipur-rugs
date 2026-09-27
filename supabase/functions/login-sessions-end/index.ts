// db-management endpoint: marks the caller's own OPEN session ended. Self-service,
// always the CALLER'S OWN account. Called two ways from apps/atlas:
//   - Awaited, before supabase.auth.signOut() (UserMenu's explicit "Sign out").
//   - Best-effort via `fetch(..., { keepalive: true })` on pagehide/beforeunload (see
//     SessionTracker.tsx) — browsers don't guarantee this fires, that's fine, the
//     heartbeat's last_heartbeat_at is the fallback source of truth for "when did this
//     session actually end" either way (see login_session_summary).
// A sessionId that's missing, not the caller's, or already ended is a silent no-op
// (200, ended: false) rather than an error — the beforeunload call racing a heartbeat or
// an already-ended session is an expected, harmless outcome, not a real failure.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EndSessionBody {
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

    const body = (await req.json()) as Partial<EndSessionBody>;
    if (!body.sessionId) {
      return jsonResponse({ error: "sessionId is required" }, 400);
    }

    const now = new Date().toISOString();
    const { data: updated, error: updateError } = await supabaseAdmin
      .from("login_sessions")
      .update({ ended_at: now, last_heartbeat_at: now })
      .eq("id", body.sessionId)
      .eq("auth_user_id", user.id)
      .is("ended_at", null)
      .select("id")
      .maybeSingle();
    if (updateError) {
      return jsonResponse({ error: updateError.message }, 500);
    }

    return jsonResponse({ sessionId: body.sessionId, ended: Boolean(updated) });
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
