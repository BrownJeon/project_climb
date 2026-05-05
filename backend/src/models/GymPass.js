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
    allowNull: false,
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
