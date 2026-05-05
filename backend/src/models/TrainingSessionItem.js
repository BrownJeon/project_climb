const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const TrainingSessionItem = sequelize.define('TrainingSessionItem', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  session_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  exercise_name: { type: DataTypes.STRING(120), allowNull: false },
  sets: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: true },
  reps_or_seconds: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  metric_unit: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: 'sec | rep | min | meter | kg | count',
  },
  weight_kg: { type: DataTypes.DECIMAL(6, 2), allowNull: true },
  notes: { type: DataTypes.TEXT, allowNull: true },
  sort_order: { type: DataTypes.SMALLINT.UNSIGNED, defaultValue: 0 },
}, {
  tableName: 'training_session_items',
  timestamps: false,
  indexes: [{ fields: ['session_id'] }],
});

module.exports = TrainingSessionItem;
