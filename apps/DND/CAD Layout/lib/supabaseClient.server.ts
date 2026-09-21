import { cookies } from "next/headers";
import { createSupabaseServerClient, type CookieAdapter } from "@jaipur-rugs/auth";
import { env } from "./env";

// Only import this file from Server Components / Route Handlers — see the browser client's
// comment for why the two are kept apart.

export async function getServerSupabaseClient() {
  const cookieStore = await cookies();

  const nextCookieAdapter: CookieAdapter = {
    get: (name) => cookieStore.get(name)?.value,
    set: (name, value, options) => cookieStore.set(name, value, options),
    remove: (name, options) => cookieStore.set(name, "", { ...options, maxAge: 0 }),
  };

  return createSupabaseServerClient(env.supabaseUrl, env.supabaseAnonKey, nextCookieAdapter, env.rootDomain, env.secureCookies);
}
