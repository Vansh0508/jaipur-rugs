// Office server (192.168.0.18) process, same pattern as apps/DND/CAD Layout/ecosystem.config.cjs: the workspace
// needs Node >= 22 but the box's pm2 daemon runs v20, so when PM2_NODE_INTERPRETER is set we run that node binary
// as the script and pass Next's CLI to it. Confirm with `ls -l /proc/$(pm2 pid sketch-challan)/exe`.
//
// Sketch Challan specifics:
//   - exactly ONE instance: demo mode keeps all data in data/*.json behind an in-process lock
//   - memory: the Maps refresh parses NAV-028 (~36 MB) and needs ~2 GB, so the heap and restart limit are raised
//   - `next start` without -H listens on every interface, so the LAN reaches http://192.168.0.18:3012
const nodeBin = process.env.PM2_NODE_INTERPRETER;
// The repo installs with node-linker=hoisted, so Next sits in this app's node_modules or the root one depending on
// the whole lockfile; resolve it instead of hardcoding either (a lockfile change on 2026-10-03 moved it to the root).
const NEXT_CLI = require.resolve("next/dist/bin/next", { paths: [__dirname] });
const PORT = process.env.PORT || 3012;
const HEAP = "--max-old-space-size=4096";

module.exports = {
  apps: [
    {
      name: "sketch-challan",
      ...(nodeBin
        ? { script: nodeBin, args: `${HEAP} ${NEXT_CLI} start -p ${PORT}` }
        : { script: NEXT_CLI, args: `start -p ${PORT}`, node_args: HEAP }),
      cwd: "./",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "4G",
      env: {
        NODE_ENV: "production",
        PORT,
      },
    },
  ],
};
