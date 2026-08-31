import { createSupabaseBrowserClient } from "@jaipur-rugs/auth";
import { env } from "./env";

/** For use in Client Components on the staff side only. Kept separate from the server
 * client for the same next/headers bundling reason as apps/hub's equivalent file. */
export function getBrowserSupabaseClient() {
  return createSupabaseBrowserClient(env.supabaseUrl, env.supabaseAnonKey, env.rootDomain);
}
