// Same Node-version workaround CAD Layout needed on this same box (192.168.0.18) — see
// apps/DND/CAD Layout/ecosystem.config.cjs for the full explanation. Short version: this
// workspace requires Node >= 22 (@supabase/supabase-js' engines field, engine-strict=true),
// but the office server's pm2 daemon runs v20, and Next's CLI is an extensionless file with
// a `#!/usr/bin/env node` shebang — PM2 execs it directly, so the shebang resolves `node`
// from the daemon's own v20 PATH no matter what `interpreter`/`env.PATH` say. So when
// PM2_NODE_INTERPRETER is set we run that node binary *as the script* and pass Next's CLI
// to it as an argument instead. Leave the variable unset anywhere the default `node` is
// already >= 22 (e.g. a local machine).
//
// Always confirm with `ls -l /proc/$(pm2 pid internal-portal)/exe` — `pm2 describe` reports
// the configured interpreter, not the binary the process actually landed on.
const nodeBin = process.env.PM2_NODE_INTERPRETER;
// Unlike the DND apps (which have their own fully-hoisted local node_modules), this app
// is a real pnpm workspace member under node-linker=hoisted: `next` physically lives only
// in the repo-root node_modules, not a local one. require.resolve follows Node's normal
// parent-directory walk from this file's own location, so it finds `next` whether it's
// hoisted locally (DND apps) or only at the workspace root (here) — no hardcoded depth.
const NEXT_CLI = require.resolve("next/dist/bin/next");

// Already running on the server at 3003 — matches the live deployment, not a fresh pick.
const PORT = process.env.PORT || 3003;

module.exports = {
  apps: [
    {
      name: "internal-portal",
      ...(nodeBin
        ? { script: nodeBin, args: `${NEXT_CLI} start -p ${PORT}` }
        : { script: NEXT_CLI, args: `start -p ${PORT}` }),
      cwd: "./",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT,
      },
    },
  ],
};
