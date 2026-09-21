// Every NEXT_PUBLIC_* reference below must be a static `process.env.NEXT_PUBLIC_X`
// property access — Next.js only inlines env vars into the client bundle when it can find
// that literal pattern at build time (see apps/admin/internal-portal/lib/env.ts).

export const env = {
  get supabaseUrl() {
    const value = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!value) throw new Error("Missing required env var: NEXT_PUBLIC_SUPABASE_URL");
    return value;
  },
  get supabaseAnonKey() {
    const value = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!value) throw new Error("Missing required env var: NEXT_PUBLIC_SUPABASE_ANON_KEY");
    return value;
  },
  /** Undefined in local dev on purpose — see .env.example. */
  get rootDomain() {
    return process.env.NEXT_PUBLIC_ROOT_DOMAIN || undefined;
  },
  /**
   * Whether the auth session cookie is marked Secure (HTTPS-only). Defaults to true — the
   * safe choice — unless explicitly set to "false". This app is deployed to the internal
   * office server over plain HTTP, and `next build`/`next start` always set
   * NODE_ENV=production regardless of the actual connection, so packages/auth's
   * NODE_ENV-only default would mark the cookie Secure on a connection that can never
   * satisfy it: browsers silently drop it, sign-in "succeeds" but the session never
   * survives the response, and the user bounces back to /login forever. Atlas hit exactly
   * this on 2026-09-02 (see apps/atlas/lib/env.ts). Set NEXT_PUBLIC_COOKIE_SECURE=false
   * only for a deployment you know is genuinely plain HTTP.
   */
  get secureCookies() {
    return process.env.NEXT_PUBLIC_COOKIE_SECURE !== "false";
  },
};
