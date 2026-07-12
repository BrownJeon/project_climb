const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Problem = sequelize.define('Problem', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    primaryKey: true,
    autoIncrement: true,
  },
  gym_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false,
  },
  sector_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true,
    comment: '섹터 (gym_sectors.id)',
  },
  level: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: '예: V3, 빨강, 5.11a',
  },
  color: {
    type: DataTypes.STRING(30),
    allowNull: true,
    comment: '홀드 색상',
  },
  section: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '구역 또는 벽 번호',
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: '현재 세팅 여부',
  },
}, {
  tableName: 'problems',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
  indexes: [
    { fields: ['gym_id'] },
  ],
});

module.exports = Problem;
