module.exports = {
  apps: [
    {
      name: 'polling-api',
      script: './src/server.js',
      instances: 'max', // Use all available CPU cores
      exec_mode: 'cluster',
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      env_staging: {
        NODE_ENV: 'staging',
        PORT: 3001
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_file: './logs/pm2-combined.log',
      time: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      kill_timeout: 3000,
      wait_ready: true,
      listen_timeout: 10000,
      restart_delay: 4000,
      max_restarts: 10,
      min_uptime: '10s'
    }
  ],

  deploy: {
    production: {
      user: 'node',
      host: ['server1.example.com', 'server2.example.com'],
      ref: 'origin/main',
      repo: 'git@github.com:username/real-time-polling-api.git',
      path: '/var/www/polling-api',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && npx prisma migrate deploy && npx prisma generate && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    },
    staging: {
      user: 'node',
      host: 'staging.example.com',
      ref: 'origin/develop',
      repo: 'git@github.com:username/real-time-polling-api.git',
      path: '/var/www/polling-api-staging',
      'post-deploy': 'npm install && npx prisma migrate deploy && npx prisma generate && pm2 reload ecosystem.config.js --env staging'
    }
  }
};