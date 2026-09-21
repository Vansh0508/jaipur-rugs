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
  // The templates/ folder is read at request time by the generate route — keep it out
  // of the bundler's hands and load it from disk (process.cwd()) instead.
  outputFileTracingIncludes: {
    "/api/generate": ["./templates/**/*"],
  },
  experimental: {
    // With a proxy.ts present, Next buffers request bodies and caps them at 10 MB by
    // default — one Tikni BMP alone is ~3 MB and a deck can carry several plus reference
    // photos, so the truncated multipart body failed to parse ("expected boundary").
    proxyClientMaxBodySize: "250mb",
  },
};

module.exports = nextConfig;
