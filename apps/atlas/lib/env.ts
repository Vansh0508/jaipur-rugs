// Every NEXT_PUBLIC_* reference below must be a static `process.env.NEXT_PUBLIC_X`
// property access, not a dynamic/bracketed lookup — Next.js only inlines env vars into
// the client bundle when it can find that literal pattern at build time (see
// apps/hub/lib/env.ts's comment, same reasoning, repeated per app on purpose).

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
  /** Where an unauthorized staff session gets bounced (AGENTS.md's "Do": redirect to the
   * Hub launcher, not a broken in-app screen). Falls back to this app's own /login when
   * unset, so local dev works before Hub has a real subdomain. */
  get hubUrl() {
    return process.env.NEXT_PUBLIC_HUB_URL || undefined;
  },
  /**
   * Whether the auth session cookie should be marked Secure (HTTPS-only). Defaults to
   * true — the safe choice for a real deployment — unless explicitly set to "false".
   * Found necessary 2026-09-02: this app's internal-server deployment is plain HTTP (no
   * TLS), and `next build`/`next start` always sets NODE_ENV=production regardless, so
   * packages/auth's old NODE_ENV-only default marked the cookie Secure on a connection
   * that can never satisfy it — browsers silently drop a Secure cookie over plain HTTP,
   * so sign-in "succeeded" but the session never survived past that one response,
   * bouncing back to /login forever. Set NEXT_PUBLIC_COOKIE_SECURE=false only for a
   * deployment you know is genuinely plain HTTP.
   */
  get secureCookies() {
    return process.env.NEXT_PUBLIC_COOKIE_SECURE !== "false";
  },
};
