import { cookies } from "next/headers";
import { createSupabaseServerClient, type CookieAdapter } from "@jaipur-rugs/auth";
import { env } from "./env";

// The one server-side Supabase client for this whole app — staff and territory-head
// salespeople alike, all Supabase Auth (see proxy.ts's comment). There used to be a
// second, Clerk-based client here just for "merchants"; removed 2026-09-01.

/** For use in Server Components and Route Handlers on the staff side. */
export async function getServerSupabaseClient() {
  const cookieStore = await cookies();

  const nextCookieAdapter: CookieAdapter = {
    get: (name) => cookieStore.get(name)?.value,
    set: (name, value, options) => cookieStore.set(name, value, options),
    remove: (name, options) => cookieStore.set(name, "", { ...options, maxAge: 0 }),
  };

  return createSupabaseServerClient(env.supabaseUrl, env.supabaseAnonKey, nextCookieAdapter, env.rootDomain, env.secureCookies);
}
