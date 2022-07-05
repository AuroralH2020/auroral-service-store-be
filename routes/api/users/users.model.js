'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('@config/sequelize.config');
const { isMultitenantEnabled } = require('@config');
const { notNull, isEmail, isAlphaOrSpecial, setIsIn } = require('@config/validations.config');
const isIn = setIsIn(['admin', 'editor', 'viewer']);

const options = {
  timestamps: false,
  defaultScope: {
    attributes: { exclude: ['password'] },
  }
};

if (isMultitenantEnabled) {
  options.schema = 'admin';
}

const UsersModel = sequelize.define(
  'user',
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false, validate: { notNull } },
    username: { type: DataTypes.STRING, allowNull: false, unique: true, validate: { notNull } },
    password: { type: DataTypes.STRING, allowNull: false, validate: { notNull } },
    email: { type: DataTypes.STRING, allowNull: false, unique: true, validate: { notNull, isEmail } },
    name: { type: DataTypes.STRING, allowNull: false, validate: { notNull, isAlphaOrSpecial } },
    surnames: { type: DataTypes.STRING, allowNull: false, validate: { notNull, isAlphaOrSpecial } },
    role: { type: DataTypes.STRING, allowNull: false, validate: { notNull, isIn } }
  },
  options
);

UsersModel.associate = function () {
  const model = modelName => this.sequelize.model(modelName);

  if (isMultitenantEnabled) {
    this.belongsTo(model('tenant'));
    console.debug('User belongs to Tenant');
  }
};

module.exports = UsersModel;
