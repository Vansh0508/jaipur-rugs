import { cookies } from "next/headers";
import { createSupabaseServerClient, type CookieAdapter } from "@jaipur-rugs/auth";
import { env } from "./env";

// Staff client only — see supabaseClient.browser.ts and lib/merchant/supabaseClient.ts
// for why merchants get an entirely separate client rather than sharing this one.

/** For use in Server Components and Route Handlers on the staff side. */
export async function getServerSupabaseClient() {
  const cookieStore = await cookies();

  const nextCookieAdapter: CookieAdapter = {
    get: (name) => cookieStore.get(name)?.value,
    set: (name, value, options) => cookieStore.set(name, value, options),
    remove: (name, options) => cookieStore.set(name, "", { ...options, maxAge: 0 }),
  };

  return createSupabaseServerClient(env.supabaseUrl, env.supabaseAnonKey, nextCookieAdapter, env.rootDomain);
}
