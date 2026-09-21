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
      // The workspace requires Node >= 22 (@supabase/supabase-js' engines field, enforced
      // by engine-strict=true in .npmrc). On the office server the pm2 CLI itself runs on
      // v20, so without an explicit interpreter PM2 launches the app under v20 and it
      // fails. Atlas is pinned the same way on that host (`pm2 describe atlas` shows a
      // v22 interpreter). Set PM2_NODE_INTERPRETER per host; unset is fine anywhere the
      // default `node` is already >= 22.
      ...(process.env.PM2_NODE_INTERPRETER ? { interpreter: process.env.PM2_NODE_INTERPRETER } : {}),
      env: {
        NODE_ENV: "production",
        PORT: process.env.PORT || 3006,
      },
    },
  ],
};
