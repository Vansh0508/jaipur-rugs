import { createSupabaseBrowserClient } from "@jaipur-rugs/auth";
import { env } from "./env";

export function getBrowserSupabaseClient() {
  return createSupabaseBrowserClient(env.supabaseUrl, env.supabaseAnonKey, env.rootDomain, env.secureCookies);
}
