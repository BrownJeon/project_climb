const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Bookmark = sequelize.define('Bookmark', {
  user_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    primaryKey: true,
  },
  ar_route_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    primaryKey: true,
  },
}, {
  tableName: 'bookmarks',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
});

module.exports = Bookmark;
