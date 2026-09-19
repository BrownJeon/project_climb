const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ClimbLogProblemPhoto = sequelize.define('ClimbLogProblemPhoto', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  climb_log_problem_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  photo_url: { type: DataTypes.STRING(500), allowNull: false },
  hold_annotations: {
    type: DataTypes.TEXT('long'), allowNull: true,
    get() {
      const v = this.getDataValue('hold_annotations');
      if (!v) return null;
      if (typeof v !== 'string') return v;
      try { return JSON.parse(v); } catch { return null; }
    },
    set(v) {
      this.setDataValue('hold_annotations', v == null ? null : (typeof v === 'string' ? v : JSON.stringify(v)));
    },
  },
  failure_tags: { type: DataTypes.STRING(255), allowNull: true },
  failure_memo: { type: DataTypes.TEXT, allowNull: true },
  review_tags: { type: DataTypes.STRING(500), allowNull: true },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, {
  tableName: 'climb_log_problem_photos',
  timestamps: false,
});

module.exports = ClimbLogProblemPhoto;
