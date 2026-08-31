"use client";

import { useMemo } from "react";
import { useAuth } from "@clerk/nextjs";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@jaipur-rugs/supabase-client";
import { env } from "../env";

/** Client Component counterpart to supabaseClient.server.ts's server version — same
 * accessToken-callback pattern, sourced from Clerk's client-side useAuth() hook instead
 * of the server auth() helper. Memoized on `getToken` identity so components using this
 * don't rebuild a new client (and lose in-flight subscriptions) on every render. */
export function useMerchantSupabaseClient() {
  const { getToken } = useAuth();

  return useMemo(
    () =>
      createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
        accessToken: async () => (await getToken()) ?? null,
      }),
    [getToken],
  );
}
