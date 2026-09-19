const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const TrainingRoutine = sequelize.define('TrainingRoutine', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  day_of_week: {
    type: DataTypes.TINYINT.UNSIGNED, allowNull: false,
    comment: '0=일,1=월,2=화,3=수,4=목,5=금,6=토',
  },
  category: {
    type: DataTypes.STRING(20), allowNull: false,
    comment: 'bouldering/endurance/conditioning/general/rest',
  },
  label: { type: DataTypes.STRING(50), allowNull: true },
  target_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  target_minutes: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  target_color: { type: DataTypes.STRING(20), allowNull: true, comment: '볼더링 목표 색상' },
  cond_unit: { type: DataTypes.STRING(10), allowNull: true, comment: 'count|time' },
  sort_order: { type: DataTypes.SMALLINT.UNSIGNED, defaultValue: 0 },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, {
  tableName: 'training_routines',
  timestamps: false,
  indexes: [{ fields: ['user_id', 'day_of_week'] }],
});

module.exports = TrainingRoutine;
