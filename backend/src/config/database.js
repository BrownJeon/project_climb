const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PWD,
  {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 3306,
    dialect: 'mysql', // mysql2 드라이버로 MariaDB 연결
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: parseInt(process.env.DB_POOL_MAX) || 10,
      min: parseInt(process.env.DB_POOL_MIN) || 2,
      acquire: parseInt(process.env.DB_POOL_ACQUIRE) || 30000,
      idle: parseInt(process.env.DB_POOL_IDLE) || 10000,
    },
    retry: {
      max: 3, // NAS 환경 타임아웃 대비 재시도
    },
    dialectOptions: {
      connectTimeout: 10000,
    },
  }
);

async function connectDB() {
  try {
    await sequelize.authenticate();
    console.log('[DB] MariaDB 연결 성공');
  } catch (error) {
    console.error('[DB] 연결 실패:', error.message);
    process.exit(1);
  }
}

module.exports = { sequelize, connectDB };
