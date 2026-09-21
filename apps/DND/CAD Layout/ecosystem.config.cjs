// The workspace requires Node >= 22 (@supabase/supabase-js' engines field, enforced at
// install time by engine-strict=true in .npmrc). On the office server the pm2 daemon runs
// on v20, and `script` below is Next's CLI — an extensionless file with a
// `#!/usr/bin/env node` shebang — so PM2 execs it directly and the shebang resolves `node`
// from the daemon's own PATH, landing on v20 whatever `interpreter` says. Setting both
// `interpreter` and a PATH that leads with the same bin directory is what actually pins it;
// verify with `ls -l /proc/$(pm2 pid cad-layout)/exe` rather than trusting `pm2 describe`.
//
// Set PM2_NODE_INTERPRETER to the absolute node binary per host. Leaving it unset is fine
// anywhere the default `node` is already >= 22 (e.g. a local machine).
const interpreter = process.env.PM2_NODE_INTERPRETER;
const path = require("node:path");

module.exports = {
  apps: [
    {
      name: "cad-layout",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3006",
      cwd: "./",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      ...(interpreter ? { interpreter } : {}),
      env: {
        NODE_ENV: "production",
        PORT: process.env.PORT || 3006,
        ...(interpreter ? { PATH: `${path.dirname(interpreter)}:${process.env.PATH ?? ""}` } : {}),
      },
    },
  ],
};
