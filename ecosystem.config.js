module.exports = {
  apps: [
    {
      name: 'theroute-api',
      script: 'backend/src/index.js',
      cwd: '/home/brownjeon/NFS/homes/brownjeon/project/TheRoute',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3100,
      },
      error_file: '/home/brownjeon/NFS/homes/brownjeon/project/TheRoute/logs/api-error.log',
      out_file: '/home/brownjeon/NFS/homes/brownjeon/project/TheRoute/logs/api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
