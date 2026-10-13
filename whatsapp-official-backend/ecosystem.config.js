/**
 * PM2 process definition for the wacrm Node backend.
 *
 * Start from this directory with:
 *   pm2 start ecosystem.config.js
 */
module.exports = {
  apps: [
    {
      name: 'waofficial-backend',
      script: './src/server.js',
      cwd: __dirname,
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      restart_delay: 3000,
      max_restarts: 10,
      min_uptime: '10s',
      time: true,
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};
