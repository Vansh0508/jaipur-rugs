// Every NEXT_PUBLIC_* reference below must be a static `process.env.NEXT_PUBLIC_X` property
// access, not a dynamic/bracketed lookup — Next.js only inlines env vars into the client
// bundle when it can find that literal pattern at build time. Same rule, same reasoning,
// as apps/analytics/lib/env.ts and apps/hub/lib/env.ts.

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
  /** Undefined in local dev on purpose — cookies stay host-only. */
  get rootDomain() {
    return process.env.NEXT_PUBLIC_ROOT_DOMAIN || undefined;
  },

/**
   * Whether an unauthenticated visitor is redirected to /login. The session is refreshed
   * and the employee looked up either way — only the redirect is gated — so turning this
   * on is a config change, not a code change.
   */
  get requireAuth() {
    return process.env.JRGPT_REQUIRE_AUTH === "true";
  },
};

/** Server-side only. Absent until a key is provisioned; /api/ask reports that plainly. */
export function modelKey(): string | undefined {
  return process.env.ANTHROPIC_API_KEY || undefined;
}
