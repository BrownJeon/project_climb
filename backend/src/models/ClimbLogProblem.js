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
    comment: '레거시 단일 link. 다중은 climb_log_problem_videos 사용',
  },
  cleared_count: {
    type: DataTypes.INTEGER.UNSIGNED, allowNull: true,
    comment: '난이도별 완등 개수 (신규 흐름)',
  },
  failed_count: {
    type: DataTypes.INTEGER.UNSIGNED, allowNull: true,
    comment: '난이도별 실패 개수 (신규 흐름)',
  },
  style: {
    type: DataTypes.STRING(20), allowNull: true,
    comment: '볼더링 카테고리: slab/vertical/overhang/cave/other',
  },
}, {
  tableName: 'climb_log_problems',
  timestamps: false,
});

module.exports = ClimbLogProblem;
