module.exports = {
  apps: [{
    name: 'zentro-game-hub',
    script: 'npm',
    args: 'start',
    cwd: '/var/www/zentro',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 8081
    },
    error_file: '/var/log/zentro/error.log',
    out_file: '/var/log/zentro/out.log',
    log_file: '/var/log/zentro/combined.log',
    time: true
  }]
};
