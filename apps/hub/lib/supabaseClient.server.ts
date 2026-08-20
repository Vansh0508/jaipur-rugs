import { cookies } from "next/headers";
import { createSupabaseServerClient, type CookieAdapter } from "@jaipur-rugs/auth";
import { env } from "./env";

// Kept separate from the browser client on purpose — see supabaseClient.browser.ts's
// comment. Only import this file from Server Components / Route Handlers.

/** For use in Server Components and Route Handlers. */
export async function getServerSupabaseClient() {
  // next/headers' cookies() is an async API as of Next 15+ — must await before reading.
  const cookieStore = await cookies();

  const nextCookieAdapter: CookieAdapter = {
    get: (name) => cookieStore.get(name)?.value,
    set: (name, value, options) => cookieStore.set(name, value, options),
    remove: (name, options) => cookieStore.set(name, "", { ...options, maxAge: 0 }),
  };

  return createSupabaseServerClient(env.supabaseUrl, env.supabaseAnonKey, nextCookieAdapter, env.rootDomain);
}
