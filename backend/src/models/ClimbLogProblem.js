const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ClimbLogProblem = sequelize.define('ClimbLogProblem', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    primaryKey: true,
    autoIncrement: true,
  },
  log_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false,
  },
  problem_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true,
    comment: 'NULL이면 custom_level/custom_color 사용',
  },
  custom_level: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  custom_color: {
    type: DataTypes.STRING(30),
    allowNull: true,
  },
  is_cleared: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  attempts: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    defaultValue: 1,
    validate: { min: 1 },
  },
  ar_route_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true,
    comment: '연결된 본인 영상 (선택)',
  },
}, {
  tableName: 'climb_log_problems',
  timestamps: false,
});

module.exports = ClimbLogProblem;
