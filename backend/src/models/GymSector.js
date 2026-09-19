const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const GymSector = sequelize.define('GymSector', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    primaryKey: true,
    autoIncrement: true,
  },
  gym_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  sort_order: {
    type: DataTypes.SMALLINT.UNSIGNED,
    defaultValue: 0,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  tableName: 'gym_sectors',
  timestamps: true,
  updatedAt: false,
  createdAt: 'created_at',
});

module.exports = GymSector;
