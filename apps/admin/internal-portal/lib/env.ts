// Every NEXT_PUBLIC_* reference below must be a static `process.env.NEXT_PUBLIC_X`
// property access, not a dynamic/bracketed lookup — Next.js only inlines env vars into
// the client bundle when it can find that literal pattern at build time. A helper that
// does `process.env[name]` looks identical at runtime on the server (where `process.env`
// is a real, fully-populated object) but silently returns undefined in the browser, since
// nothing was inlined there. Keep each getter's env var reference written out in full.

export const env = {
  get supabaseUrl() {
    const value = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!value) throw new Error("Missing required env var: NEXT_PUBLIC_SUPABASE_URL");
    return value;
  },
  /**
   * Prefers the new publishable key (`sb_publishable_...`) over the legacy anon JWT — see
   * https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys. The legacy
   * var is only a fallback for a .env.local that hasn't been updated yet; set
   * NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY going forward.
   */
  get supabasePublishableKey() {
    const value =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!value) {
      throw new Error(
        "Missing required env var: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or legacy NEXT_PUBLIC_SUPABASE_ANON_KEY)"
      );
    }
    return value;
  },
  /** Undefined in local dev on purpose — see .env.example. */
  get rootDomain() {
    return process.env.NEXT_PUBLIC_ROOT_DOMAIN || undefined;
  },
  /**
   * Whether the auth session cookie is marked Secure (HTTPS-only). Defaults to true — the
   * safe choice — unless explicitly set to "false". This app is deployed to the internal
   * office server (192.168.0.18) over plain HTTP, and `next build`/`next start` always set
   * NODE_ENV=production regardless of the actual connection, so packages/auth's
   * NODE_ENV-only default would mark the cookie Secure on a connection that can never
   * satisfy it: browsers silently drop it, sign-in "succeeds" but the session never
   * survives the response, and the user bounces back to /login forever. Atlas hit exactly
   * this on 2026-09-02, CAD Layout guarded against it the same way (see their lib/env.ts).
   * Set NEXT_PUBLIC_COOKIE_SECURE=false only for a deployment you know is genuinely plain HTTP.
   */
  get secureCookies() {
    return process.env.NEXT_PUBLIC_COOKIE_SECURE !== "false";
  },
};

// Driver photos live in the `driver-photos` Supabase Storage bucket (public — see
// db/feedback/005_create_driver_photos_bucket.sql), shared with the Feedback App. This is
// a deliberate override of AGENTS.md's default "self-hosted S3" object storage choice,
// recorded in AGENTS.md Section 1 — not the general pattern for other modules.
const DRIVER_PHOTOS_BUCKET = "driver-photos";

/** Resolves a `drivers.photo_path` Storage object key into a public viewable URL. */
export function resolvePhotoUrl(photoPath: string | null): string | null {
  if (!photoPath) return null;
  return `${env.supabaseUrl}/storage/v1/object/public/${DRIVER_PHOTOS_BUCKET}/${photoPath.replace(/^\//, "")}`;
}
