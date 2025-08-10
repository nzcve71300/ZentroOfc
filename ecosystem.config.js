module.exports = {
  apps: [
    {
      name: 'zentro-bot',
      script: 'src/index.js',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      log_file: './logs/combined.log',
      out_file: './logs/bot-out.log',
      error_file: './logs/bot-error.log',
      time: true,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env_production: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'nivaro-api',
      script: 'src/api/server.js',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
        API_PORT: 3001
      },
      log_file: './logs/api-combined.log',
      out_file: './logs/api-out.log',
      error_file: './logs/api-error.log',
      time: true,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env_production: {
        NODE_ENV: 'production'
      }
    }
  ]
}; 