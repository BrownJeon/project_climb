module.exports = {
  apps: [
    {
      name: 'theroute-api',
      script: 'src/index.js',
      cwd: '/home/brownjeon/NFS/homes/brownjeon/project/TheRoute/backend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
      error_file: '/home/brownjeon/NFS/homes/brownjeon/project/TheRoute/logs/api-error.log',
      out_file: '/home/brownjeon/NFS/homes/brownjeon/project/TheRoute/logs/api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
