const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const GymSectorSchedule = sequelize.define('GymSectorSchedule', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  gym_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  sector_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
  frequency: { type: DataTypes.ENUM('weekly', 'biweekly', 'monthly', 'once'), allowNull: false },
  day_of_week: { type: DataTypes.TINYINT, allowNull: true, comment: '0=일,1=월,...,6=토 (weekly/biweekly)' },
  day_of_month: { type: DataTypes.TINYINT.UNSIGNED, allowNull: true, comment: '1-31 (monthly)' },
  start_date: { type: DataTypes.DATEONLY, allowNull: true, comment: 'biweekly 앵커 날짜' },
  note: { type: DataTypes.STRING(200), allowNull: true },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
}, {
  tableName: 'gym_sector_schedules',
  timestamps: true,
  updatedAt: false,
  createdAt: 'created_at',
});

module.exports = GymSectorSchedule;
