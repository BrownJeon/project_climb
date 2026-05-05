const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const TrainingGoal = sequelize.define('TrainingGoal', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  title: { type: DataTypes.STRING(200), allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  category: {
    type: DataTypes.STRING(30),
    allowNull: false,
    comment: 'boulder_grade | endurance_metric | frequency | free',
  },
  metric_label: { type: DataTypes.STRING(80), allowNull: true },
  target_value: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  current_value: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  target_date: { type: DataTypes.DATEONLY, allowNull: true },
  status: {
    type: DataTypes.ENUM('in_progress', 'done', 'archived'),
    allowNull: false,
    defaultValue: 'in_progress',
  },
  progress_percent: {
    type: DataTypes.SMALLINT.UNSIGNED,
    allowNull: false,
    defaultValue: 0,
  },
}, {
  tableName: 'training_goals',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [{ fields: ['user_id', 'status'] }],
});

module.exports = TrainingGoal;
