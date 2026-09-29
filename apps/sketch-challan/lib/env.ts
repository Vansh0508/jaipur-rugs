export const env = {
  // Fail closed: demo login only when SKETCH_CHALLAN_DEMO_MODE is exactly "true". Server-only on purpose:
  // a NEXT_PUBLIC_ variable is frozen into the build, so a build made in demo mode stayed in demo mode.
  get demoMode() { return process.env.SKETCH_CHALLAN_DEMO_MODE === "true"; },
  get supabaseUrl() { return process.env.NEXT_PUBLIC_SUPABASE_URL || ""; },
  get supabaseAnonKey() { return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""; },
  get rootDomain() { return process.env.NEXT_PUBLIC_ROOT_DOMAIN || undefined; },
  get secureCookies() { return process.env.NEXT_PUBLIC_COOKIE_SECURE !== "false"; },
};
