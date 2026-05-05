const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ClimbLog = sequelize.define('ClimbLog', {
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
  visited_at: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  memo: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  gym_pass_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true,
    comment: '정기권/횟수권 사용 시 연결',
  },
  used_day_pass: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: '일일이용권 사용 시 true (gym_pass_id와 XOR)',
  },
  duration_minutes: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    comment: '운동 시간(분)',
  },
}, {
  tableName: 'climb_logs',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
  indexes: [
    { fields: ['user_id', 'visited_at'] },
  ],
});

module.exports = ClimbLog;
