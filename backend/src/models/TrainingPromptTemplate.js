const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const TrainingPromptTemplate = sequelize.define('TrainingPromptTemplate', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  key: {
    type: DataTypes.STRING(80),
    allowNull: false,
    unique: true,
    comment: '식별자 (예: analysis_meta_v1)',
  },
  name: { type: DataTypes.STRING(120), allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  meta_prompt_text: {
    type: DataTypes.TEXT('medium'),
    allowNull: false,
    comment: '1단계 CLI 입력 메타 프롬프트 (placeholder 포함)',
  },
  version: {
    type: DataTypes.SMALLINT.UNSIGNED,
    allowNull: false,
    defaultValue: 1,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
}, {
  tableName: 'training_prompt_templates',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = TrainingPromptTemplate;
