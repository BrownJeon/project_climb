const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ArRoute = sequelize.define('ArRoute', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    primaryKey: true,
    autoIncrement: true,
  },
  user_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false,
  },
  problem_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true,
  },
  title: {
    type: DataTypes.STRING(200),
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  video_url: {
    type: DataTypes.STRING(500),
    allowNull: false,
    comment: '업로드된 원본 영상 URL',
  },
  thumbnail_url: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  ar_data: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: '{ version, duration, frames: [{time, type, position, order, color}] }',
    get() {
      const v = this.getDataValue('ar_data');
      if (typeof v === 'string') {
        try { return JSON.parse(v); } catch { return null; }
      }
      return v;
    },
  },
  tags: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: '{ wall_type, techniques: [], custom: [] }',
    get() {
      const v = this.getDataValue('tags');
      if (typeof v === 'string') {
        try { return JSON.parse(v); } catch { return null; }
      }
      return v;
    },
  },
  like_count: {
    type: DataTypes.INTEGER.UNSIGNED,
    defaultValue: 0,
  },
  view_count: {
    type: DataTypes.INTEGER.UNSIGNED,
    defaultValue: 0,
  },
}, {
  tableName: 'ar_routes',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['user_id'] },
    { fields: ['problem_id'] },
    { fields: ['created_at'] },
  ],
});

module.exports = ArRoute;
