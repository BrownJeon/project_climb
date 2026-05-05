const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    primaryKey: true,
    autoIncrement: true,
  },
  sns_provider: {
    type: DataTypes.ENUM('google', 'kakao', 'local'),
    allowNull: true,   // 1인용 디폴트 사용자 등 SNS 미연동 케이스 허용
  },
  sns_id: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  nickname: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  profile_image: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  bio: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  max_level: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: 'deprecated — max_level_grade 사용',
  },
  main_gym_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true,
    comment: 'deprecated — user_main_gyms 조인 테이블 사용',
  },
  climbing_started_at: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    comment: '처음 클라이밍 시작일 (07 마이페이지)',
  },
  max_level_color: {
    type: DataTypes.STRING(30),
    allowNull: true,
    comment: '최고 레벨 홀드 색상 (red/yellow/...)',
  },
  max_level_grade: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: '최고 레벨 V등급 (V1~V12)',
  },
  max_level_gym_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true,
    comment: '최고 레벨 매핑 기준 암장',
  },
}, {
  tableName: 'users',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { unique: true, fields: ['sns_provider', 'sns_id'] },
  ],
});

module.exports = User;
