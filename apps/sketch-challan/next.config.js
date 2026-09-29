const path = require("node:path");

// Monorepo root holds the hoisted node_modules; pin it so Turbopack doesn't guess from lockfiles.
const root = path.join(__dirname, "..", "..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  turbopack: { root },
  outputFileTracingRoot: root,
  transpilePackages: [
    "@jaipur-rugs/auth",
    "@jaipur-rugs/db-management-client",
    "@jaipur-rugs/supabase-client",
    "@jaipur-rugs/ui-kit",
  ],
};
module.exports = nextConfig;
