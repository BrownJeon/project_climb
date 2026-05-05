const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const UserMainGym = sequelize.define('UserMainGym', {
  user_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    primaryKey: true,
  },
  gym_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    primaryKey: true,
  },
  sort_order: {
    type: DataTypes.SMALLINT.UNSIGNED,
    defaultValue: 0,
  },
}, {
  tableName: 'user_main_gyms',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
});

module.exports = UserMainGym;
