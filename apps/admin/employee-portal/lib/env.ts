// Every NEXT_PUBLIC_* reference below must be a static `process.env.NEXT_PUBLIC_X` property
// access — Next.js only inlines env vars into the client bundle when it finds that literal
// pattern at build time (same rule as apps/admin/internal-portal/lib/env.ts).

export const env = {
  get supabaseUrl() {
    const value = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!value) throw new Error("Missing required env var: NEXT_PUBLIC_SUPABASE_URL");
    return value;
  },
  /** The publishable key (`sb_publishable_...`); the legacy anon key still works as a fallback. */
  get supabasePublishableKey() {
    const value = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!value) {
      throw new Error("Missing required env var: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or legacy NEXT_PUBLIC_SUPABASE_ANON_KEY)");
    }
    return value;
  },
};
