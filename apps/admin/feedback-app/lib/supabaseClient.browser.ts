import { createSupabaseBrowserClient } from "@jaipur-rugs/auth";
import { env } from "./env";

/**
 * For use in Client Components only. Deliberately kept in its own file, separate from
 * the server client — `next/headers` (used by the server client) can't be bundled into
 * client code at all, even if a client component never calls the server function, since
 * ES module imports are evaluated for the whole file regardless of which export is used.
 */
export function getBrowserSupabaseClient() {
  return createSupabaseBrowserClient(env.supabaseUrl, env.supabaseAnonKey, env.rootDomain);
}
