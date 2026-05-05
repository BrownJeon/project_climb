const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Gym = sequelize.define('Gym', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '표시용 통합 이름 (brand + branch)',
  },
  brand: {
    type: DataTypes.STRING(80),
    allowNull: true,
    comment: '암장 브랜드/체인명 (예: 더클라임)',
  },
  branch: {
    type: DataTypes.STRING(80),
    allowNull: true,
    comment: '지점 (예: 강남점)',
  },
  address: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  lat: {
    type: DataTypes.DECIMAL(10, 7),
    allowNull: true,
  },
  lng: {
    type: DataTypes.DECIMAL(10, 7),
    allowNull: true,
  },
  phone: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  hours: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: '영업시간 JSON: { mon: "09:00-22:00", ... }',
  },
  price_info: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  thumbnail: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
}, {
  tableName: 'gyms',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
  indexes: [
    { fields: ['lat', 'lng'] },
  ],
});

module.exports = Gym;
