/** @type {import('next').NextConfig} */
const nextConfig = {
  // Team-shared packages are consumed as TS source (see each package's `main`), so Next
  // needs to transpile them itself rather than expecting pre-built JS.
  transpilePackages: [
    "@jaipur-rugs/auth",
    "@jaipur-rugs/db-management-client",
    "@jaipur-rugs/supabase-client",
    "@jaipur-rugs/ui-kit",
  ],
};

module.exports = nextConfig;
