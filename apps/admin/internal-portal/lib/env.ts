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
  get supabaseAnonKey() {
    const value = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!value) throw new Error("Missing required env var: NEXT_PUBLIC_SUPABASE_ANON_KEY");
    return value;
  },
  /** Undefined in local dev on purpose — see .env.example. */
  get rootDomain() {
    return process.env.NEXT_PUBLIC_ROOT_DOMAIN || undefined;
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
