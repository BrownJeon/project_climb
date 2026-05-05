const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const TrainingSession = sequelize.define('TrainingSession', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  session_date: { type: DataTypes.DATEONLY, allowNull: false },
  category: {
    type: DataTypes.ENUM('bouldering', 'endurance', 'conditioning'),
    allowNull: false,
  },
  gym_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
  duration_minutes: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  memo: { type: DataTypes.TEXT, allowNull: true },
}, {
  tableName: 'training_sessions',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
  indexes: [{ fields: ['user_id', 'session_date'] }],
});

module.exports = TrainingSession;
