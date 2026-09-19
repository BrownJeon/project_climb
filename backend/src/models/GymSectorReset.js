const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const GymSectorReset = sequelize.define('GymSectorReset', {
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
  },
  reset_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  note: {
    type: DataTypes.STRING(200),
    allowNull: true,
  },
}, {
  tableName: 'gym_sector_resets',
  timestamps: true,
  updatedAt: false,
  createdAt: 'created_at',
});

module.exports = GymSectorReset;
