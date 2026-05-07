const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ClimbLogProblemVideo = sequelize.define('ClimbLogProblemVideo', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  climb_log_problem_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  ar_route_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  sort_order: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: false, defaultValue: 0 },
}, {
  tableName: 'climb_log_problem_videos',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
  indexes: [{ fields: ['climb_log_problem_id'] }, { unique: true, fields: ['climb_log_problem_id', 'ar_route_id'] }],
});

module.exports = ClimbLogProblemVideo;
