const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const GymPass = sequelize.define('GymPass', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    primaryKey: true,
    autoIncrement: true,
  },
  user_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false,
  },
  gym_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true,
    comment: '등록 시점 대표 지점 (브랜드 추적용 보조)',
  },
  brand: {
    type: DataTypes.STRING(80),
    allowNull: true,
    comment: '이용권이 적용되는 브랜드명 — 같은 brand의 모든 지점에서 사용 가능',
  },
  pass_type: {
    type: DataTypes.ENUM('period', 'count'),
    allowNull: false,
    comment: 'period=정기권, count=횟수권',
  },
  label: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '사용자 지정 별칭 (예: 월정기권, 10회권)',
  },
  // 정기권 전용
  start_date: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  end_date: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  // 횟수권 전용
  total_count: {
    type: DataTypes.SMALLINT.UNSIGNED,
    allowNull: true,
  },
  remaining_count: {
    type: DataTypes.SMALLINT.UNSIGNED,
    allowNull: true,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  tableName: 'gym_passes',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['user_id', 'is_active'] },
  ],
});

module.exports = GymPass;
