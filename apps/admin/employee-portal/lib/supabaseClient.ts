import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";

// A deliberately session-less client — publishable key only, no auth persistence. The employee
// portal has no login (product decision), so there is no session to share and nothing for
// packages/auth to do; this client is only ever used to call the booking-request Edge
// Functions through packages/db-management-client. Not @jaipur-rugs/auth's browser client on
// purpose: that one reads the shared Supabase Auth cookie, and on localhost (cookies ignore the
// port) it would pick up an Internal Portal admin's session from the other tab and send it
// along. Usable from Server and Client Components alike.

let browserClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  const create = () =>
    createClient(env.supabaseUrl, env.supabasePublishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  if (typeof window === "undefined") return create();
  browserClient ??= create();
  return browserClient;
}
