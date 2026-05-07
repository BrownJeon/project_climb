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
  current_metric_label: { type: DataTypes.STRING(40), allowNull: true, comment: '현재 난이도/측정 라벨' },
  target_value: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  current_value: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  start_date: { type: DataTypes.DATEONLY, allowNull: true, comment: '목표 시작일' },
  target_date: { type: DataTypes.DATEONLY, allowNull: true, comment: '목표 마감일' },
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
  auto_sync: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    comment: '운동 기록 변경 시 current_value/progress_percent 자동 재계산',
  },
  target_gym_id: {
    type: DataTypes.BIGINT.UNSIGNED, allowNull: true,
    comment: '특정 지점만 카운트 (NULL=무관)',
  },
  target_brand: {
    type: DataTypes.STRING(80), allowNull: true,
    comment: '같은 브랜드 모든 지점 카운트 (NULL=무관)',
  },
  target_level: {
    type: DataTypes.STRING(10), allowNull: true,
    comment: 'V등급 (NULL=색상만 매칭)',
  },
}, {
  tableName: 'training_goals',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [{ fields: ['user_id', 'status'] }],
});

module.exports = TrainingGoal;
