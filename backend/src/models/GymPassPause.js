const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const GymPassPause = sequelize.define('GymPassPause', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  gym_pass_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  started_at: { type: DataTypes.DATEONLY, allowNull: false },
  ended_at:   { type: DataTypes.DATEONLY, allowNull: true },
  days_used:  { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  note:       { type: DataTypes.STRING(200), allowNull: true },
}, {
  tableName: 'gym_pass_pauses',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
  indexes: [{ fields: ['gym_pass_id', 'started_at'] }],
});

module.exports = GymPassPause;
