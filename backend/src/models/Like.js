const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Like = sequelize.define('Like', {
  user_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    primaryKey: true,
  },
  ar_route_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    primaryKey: true,
  },
}, {
  tableName: 'likes',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
});

module.exports = Like;
