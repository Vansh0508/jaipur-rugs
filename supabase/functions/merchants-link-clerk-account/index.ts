// db-management write endpoint: the ONLY way merchants.clerk_user_id ever gets set.
// Called by apps/atlas's merchant shell right after a Clerk sign-in, before rendering any
// order data — until this succeeds once, private.can_view_order()'s merchant branch has
// nothing to match, so the person sees zero orders (fails closed, not open).
//
// Deliberately verifies the Clerk session token itself, server-side, via @clerk/backend
// — NOT via Supabase's own verify_jwt/auth.getUser() gate (this function has
// verify_jwt = false in supabase/config.toml). Two independent reasons: (1) this repo's
// Supabase project may not have Clerk configured as a Third-Party Auth provider yet (see
// AGENTS.md's recorded override — a one-time Dashboard step this session couldn't
// perform), so relying on Supabase to recognize the token would silently no-op until
// that's done; (2) even once it is configured, re-verifying independently here means
// this specific security-sensitive linking step doesn't depend on that platform
// integration being configured correctly.
//
// Never auto-creates a merchants row from an unrecognized email — a real external
// customer's access is provisioned by merchants-invite (admin), not by whoever happens
// to sign up with a matching-looking email.

import { createClient } from "npm:@supabase/supabase-js@2";
import { createClerkClient, verifyToken } from "npm:@clerk/backend@1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const clerkSecretKey = Deno.env.get("CLERK_SECRET_KEY");
  if (!clerkSecretKey) {
    return jsonResponse({ error: "server misconfigured: CLERK_SECRET_KEY not set" }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return jsonResponse({ error: "missing Authorization bearer token" }, 401);
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const verified = await verifyToken(token, { secretKey: clerkSecretKey });
    const clerkUserId = verified.sub;
    if (!clerkUserId) {
      return jsonResponse({ error: "token did not contain a subject" }, 401);
    }

    // The session token itself isn't guaranteed to carry an email claim (depends on the
    // Clerk instance's JWT template) — fetch the verified email from Clerk's own API
    // rather than trusting anything client-supplied.
    const clerkClient = createClerkClient({ secretKey: clerkSecretKey });
    const clerkUser = await clerkClient.users.getUser(clerkUserId);
    const verifiedEmail = clerkUser.emailAddresses.find(
      (e) => e.id === clerkUser.primaryEmailAddressId,
    )?.emailAddress;
    if (!verifiedEmail) {
      return jsonResponse({ error: "no verified primary email on this Clerk account" }, 400);
    }

    const { data: merchant, error: merchantError } = await supabaseAdmin
      .from("merchants")
      .select("id, clerk_user_id")
      .ilike("primary_contact_email", verifiedEmail)
      .maybeSingle();
    if (merchantError) return jsonResponse({ error: merchantError.message }, 500);
    if (!merchant) {
      return jsonResponse(
        { error: "no merchant record for this email — contact your Jaipur Rugs representative" },
        404,
      );
    }

    if (merchant.clerk_user_id && merchant.clerk_user_id !== clerkUserId) {
      return jsonResponse(
        { error: "this merchant record is already linked to a different account" },
        409,
      );
    }

    if (merchant.clerk_user_id !== clerkUserId) {
      const { error: updateError } = await supabaseAdmin
        .from("merchants")
        .update({ clerk_user_id: clerkUserId, updated_at: new Date().toISOString() })
        .eq("id", merchant.id);
      if (updateError) return jsonResponse({ error: updateError.message }, 500);
    }

    return jsonResponse({ merchantId: merchant.id }, 200);
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "verification failed" }, 401);
  }
});

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
