import { cookies } from "next/headers";
import { createSupabaseServerClient, type CookieAdapter } from "@jaipur-rugs/auth";
import { env } from "./env";

export async function getServerSupabaseClient() {
  const store = await cookies();
  const adapter: CookieAdapter = {
    get: (name) => store.get(name)?.value,
    set: (name, value, options) => store.set(name, value, options),
    remove: (name, options) => store.set(name, "", { ...options, maxAge: 0 }),
  };
  return createSupabaseServerClient(env.supabaseUrl, env.supabaseAnonKey, adapter, env.rootDomain, env.secureCookies);
}
