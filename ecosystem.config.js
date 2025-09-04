module.exports = {
  apps: [
    {
      name: 'zentro-bot',
      script: './src/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/zentro-bot-error.log',
      out_file: './logs/zentro-bot-out.log',
      log_file: './logs/zentro-bot-combined.log',
      time: true
    },
    {
      name: 'zone-refresh-system',
      script: './zone_refresh_system.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/zone-refresh-error.log',
      out_file: './logs/zone-refresh-out.log',
      log_file: './logs/zone-refresh-combined.log',
      time: true,
      // Run every 5 minutes
      cron_restart: '*/5 * * * *',
      // Keep it running even if it crashes
      restart_delay: 10000,
      max_restarts: 10
    }
  ]
}; 