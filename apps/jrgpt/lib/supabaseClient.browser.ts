"use client";

import { createSupabaseBrowserClient } from "@jaipur-rugs/auth";
import { env } from "./env";

/** One client per tab; the cookie is shared with Hub so signing in here signs you in there. */
let client: ReturnType<typeof createSupabaseBrowserClient> | undefined;

export function getBrowserSupabaseClient() {
  if (!client) {
    client = createSupabaseBrowserClient(env.supabaseUrl, env.supabaseAnonKey, env.rootDomain);
  }
  return client;
}
