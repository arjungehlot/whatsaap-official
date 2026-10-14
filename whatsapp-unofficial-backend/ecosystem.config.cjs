module.exports = {
  apps: [
    {
      name: "waflow-backend",
      script: "src/server.js",
      cwd: __dirname,
      interpreter: "node",
      exec_mode: "fork",
      instances: 1,
      watch: false,
      autorestart: true,
      max_memory_restart: "512M",
      time: true,
      env_production: {
        NODE_ENV: "production",
      },
    },
  ],
};
