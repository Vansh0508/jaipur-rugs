// Shared session/cookie logic + cross-app SSO helpers (AGENTS.md Section 4 / 5).
// Every app builds its Supabase clients from here rather than reimplementing cookie
// handling, so cross-subdomain session sharing (`domain: .jaipurrugs.com`) can't diverge
// per app. Feedback App is the first real consumer; Hub and every future app reuse this
// unchanged.
//
// This module is framework-agnostic on purpose — it doesn't import `next/headers` — the
// caller supplies a small cookie adapter for server-side use (see CookieAdapter below) so
// this package stays usable outside Next.js Route Handlers/Server Components too.

import { createBrowserClient, createServerClient, type CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

export const ROOT_COOKIE_DOMAIN_ENV_VAR = "NEXT_PUBLIC_ROOT_DOMAIN";

/**
 * Cookie options shared by every app's Supabase client. Scoping to the root domain
 * (e.g. `.jaipurrugs.com`) is what makes a session set by one app's login readable by
 * every other subdomain (AGENTS.md Section 5) — this is the one place that scoping is
 * decided, so it can't quietly diverge between apps.
 *
 * `secureCookie` defaults to `NODE_ENV === "production"` when not given — the original,
 * unchanged behavior for every app deployed over real HTTPS (Vercel etc.). Found broken
 * 2026-09-02 on Atlas's internal-server deployment (plain HTTP, no TLS): `next build`/
 * `next start` always sets NODE_ENV=production regardless of the actual connection, so
 * the cookie was marked Secure on a connection that can never satisfy it — browsers
 * silently refuse to store a Secure cookie over plain HTTP, so login "succeeded" but the
 * session never persisted past that one response, bouncing back to /login forever. Pass
 * `secureCookie: false` explicitly for any deployment that's genuinely plain HTTP.
 */
export function rootCookieOptions(rootDomain: string | undefined, secureCookie?: boolean): CookieOptions {
  return {
    domain: rootDomain, // undefined in local dev (e.g. localhost) — browsers ignore an unset domain, cookie just stays host-only
    path: "/",
    sameSite: "lax",
    secure: secureCookie ?? process.env.NODE_ENV === "production",
  };
}

/** Browser-side client — safe to call from any client component. Anon key only. */
export function createSupabaseBrowserClient(
  url: string,
  anonKey: string,
  rootDomain?: string,
  secureCookie?: boolean,
): SupabaseClient {
  return createBrowserClient(url, anonKey, {
    cookieOptions: rootCookieOptions(rootDomain, secureCookie),
  });
}

/**
 * Minimal cookie adapter the caller provides for server-side use (Route Handlers,
 * Server Components, middleware). Matches the shape Next.js's `cookies()` already has,
 * so wiring this up in an app is a one-line pass-through, not new code per app.
 */
export interface CookieAdapter {
  get(name: string): string | undefined;
  set(name: string, value: string, options: CookieOptions): void;
  remove(name: string, options: CookieOptions): void;
}

/** Server-side client — for Route Handlers, Server Components, and middleware. Anon key only. */
export function createSupabaseServerClient(
  url: string,
  anonKey: string,
  cookies: CookieAdapter,
  rootDomain?: string,
  secureCookie?: boolean,
): SupabaseClient {
  const cookieOptions = rootCookieOptions(rootDomain, secureCookie);

  return createServerClient(url, anonKey, {
    cookieOptions,
    cookies: {
      get: (name: string) => cookies.get(name),
      // @supabase/ssr calls set/remove internally to persist a refreshed auth session on
      // essentially every request — including from a plain Server Component render, where
      // Next.js's cookies() is read-only and throws ("Cookies can only be modified in a
      // Server Action or Route Handler"). Swallow that specific failure: proxy.ts (running
      // as middleware, where cookies() IS writable) refreshes the session on the next
      // request regardless, so a no-op here from a Server Component is harmless — see
      // https://nextjs.org/docs/app/api-reference/functions/cookies#options. A Route
      // Handler or Server Action calling this still writes cookies normally; only the
      // read-only-context failure is caught.
      set: (name: string, value: string, options: CookieOptions) => {
        try {
          cookies.set(name, value, { ...cookieOptions, ...options });
        } catch {
          // Called from a context where cookies() is read-only — see comment above.
        }
      },
      remove: (name: string, options: CookieOptions) => {
        try {
          cookies.remove(name, { ...cookieOptions, ...options });
        } catch {
          // Called from a context where cookies() is read-only — see comment above.
        }
      },
    },
  });
}
