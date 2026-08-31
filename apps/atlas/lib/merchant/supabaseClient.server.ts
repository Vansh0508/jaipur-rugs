import { auth } from "@clerk/nextjs/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@jaipur-rugs/supabase-client";
import { env } from "../env";

// Merchant-side client, entirely separate from the staff one (supabaseClient.server.ts)
// — this is the AGENTS.md Section 1.1/Section 4 "Clerk is Atlas-only, not promoted into
// packages/auth" decision (recorded in AGENTS.md). Uses supabase-js's `accessToken`
// option (Supabase's documented third-party-auth pattern) rather than
// packages/auth's cookie-based createSupabaseServerClient — a merchant never has a
// Supabase Auth session at all, only a Clerk one, so packages/auth's cookie plumbing
// doesn't apply here.
//
// For RLS (private.can_view_order()'s merchant branch) to actually recognize this token
// and populate auth.jwt(), Clerk must be configured as a Supabase Third-Party Auth
// provider in the Dashboard — see db/orders/README.md. Until that's done, queries made
// with this client succeed as `authenticated`-shaped requests but simply return zero
// rows for a merchant (fails closed).
export async function getServerMerchantSupabaseClient(): Promise<SupabaseClient<Database>> {
  const { getToken } = await auth();

  return createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    accessToken: async () => (await getToken()) ?? null,
  });
}
