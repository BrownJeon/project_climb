const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Follow = sequelize.define('Follow', {
  follower_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    primaryKey: true,
  },
  following_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    primaryKey: true,
  },
}, {
  tableName: 'follows',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
});

module.exports = Follow;
