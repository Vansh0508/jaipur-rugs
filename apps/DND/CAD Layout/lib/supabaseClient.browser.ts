import { createSupabaseBrowserClient } from "@jaipur-rugs/auth";
import { env } from "./env";

/**
 * For Client Components only. Kept in its own file because the server client imports
 * `next/headers`, which can't be bundled into client code even if never called.
 */
export function getBrowserSupabaseClient() {
  return createSupabaseBrowserClient(env.supabaseUrl, env.supabaseAnonKey, env.rootDomain, env.secureCookies);
}
