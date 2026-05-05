const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const TrainingAnalysis = sequelize.define('TrainingAnalysis', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  period_from: { type: DataTypes.DATEONLY, allowNull: false },
  period_to: { type: DataTypes.DATEONLY, allowNull: false },
  perspectives: { type: DataTypes.JSON, allowNull: false },
  engine: {
    type: DataTypes.STRING(40),
    allowNull: false,
    defaultValue: 'claude-cli',
  },
  cli_version: { type: DataTypes.STRING(40), allowNull: true },
  template_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
  template_key: { type: DataTypes.STRING(80), allowNull: true },
  template_version: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: true },
  meta_prompt_text: { type: DataTypes.TEXT('medium'), allowNull: true },
  generated_prompt_text: { type: DataTypes.TEXT('medium'), allowNull: true },
  result_markdown: { type: DataTypes.TEXT('medium'), allowNull: false },
  stage1_duration_ms: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  stage2_duration_ms: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  duration_ms: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
}, {
  tableName: 'training_analyses',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
  indexes: [{ fields: ['user_id', 'created_at'] }],
});

module.exports = TrainingAnalysis;
