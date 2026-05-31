const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ClimbLogProblemPersonalVideo = sequelize.define('ClimbLogProblemPersonalVideo', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  climb_log_problem_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  video_url: { type: DataTypes.STRING(500), allowNull: false },
  thumbnail_url: { type: DataTypes.STRING(500), allowNull: true },
  video_status: {
    type: DataTypes.ENUM('processing', 'ready', 'error'),
    allowNull: false, defaultValue: 'processing',
  },
  sort_order: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: false, defaultValue: 0 },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, {
  tableName: 'climb_log_problem_personal_videos',
  timestamps: false,
  indexes: [{ fields: ['climb_log_problem_id'] }],
});

module.exports = ClimbLogProblemPersonalVideo;
