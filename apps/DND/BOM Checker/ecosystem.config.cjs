module.exports = {
  apps: [
    {
      name: "bom-management",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3005",
      cwd: "./",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: process.env.PORT || 3005,
      },
    },
  ],
};
