// The workspace requires Node >= 22 (@supabase/supabase-js' engines field, enforced at
// install time by engine-strict=true in .npmrc). The office server's pm2 daemon runs on
// v20, and Next's CLI is an extensionless file with a `#!/usr/bin/env node` shebang, so
// PM2 execs it directly and the shebang picks up the daemon's `node` — v20. Neither
// PM2's `interpreter` option nor an overridden `env.PATH` changed that in practice
// (verified on the box: `/proc/<pid>/exe` still pointed at v20 both ways).
//
// So when PM2_NODE_INTERPRETER is set we run that node binary *as the script* and pass
// Next's CLI to it as an argument — no shebang, no PATH lookup, no ambiguity. Leave the
// variable unset anywhere the default `node` is already >= 22 (e.g. a local machine).
//
// Always confirm with `ls -l /proc/$(pm2 pid cad-layout)/exe`; `pm2 describe` reports the
// configured interpreter, not the binary the process actually ended up on.
const nodeBin = process.env.PM2_NODE_INTERPRETER;
const NEXT_CLI = "node_modules/next/dist/bin/next";
const PORT = process.env.PORT || 3006;

module.exports = {
  apps: [
    {
      name: "cad-layout",
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
