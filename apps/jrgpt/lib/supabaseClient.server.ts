import "server-only";
import { cookies } from "next/headers";
import { createSupabaseServerClient, type CookieAdapter } from "@jaipur-rugs/auth";
import { env } from "./env";

/**
 * Server-side Supabase client for the SHARED project (employees, jrgpt_pins) — not the NAV
 * mirror, which is a different database read through lib/warehouse.ts.
 *
 * Cookie handling comes from packages/auth so the session stays shared with Hub and the
 * other apps; see apps/admin/internal-portal/lib/supabaseClient.server.ts for the same shape.
 */
export async function supabaseServer() {
  const store = await cookies();
  const adapter: CookieAdapter = {
    get: (name) => store.get(name)?.value,
    set: (name, value, options) => {
      try {
        store.set(name, value, options);
      } catch {
        // Server Components can't set cookies; the proxy refreshes the session instead.
      }
    },
    remove: (name, options) => {
      try {
        store.set(name, "", { ...options, maxAge: 0 });
      } catch {
        /* as above */
      }
    },
  };
  return createSupabaseServerClient(env.supabaseUrl, env.supabaseAnonKey, adapter, env.rootDomain, env.secureCookies);
}

/**
 * The signed-in employee, or null. Returns the employees row rather than the auth user,
 * because employees.id is the identity every module keys to — including jrgpt_pins.
 */
export async function currentEmployee(): Promise<{ id: string; full_name: string } | null> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("employees")
    .select("id, full_name")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  return data ?? null;
}
