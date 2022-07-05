'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('@config/sequelize.config');
const { notNull } = require('@config/validations.config');
const { CrudRepository } = require('@shared/layers/crud.repository');
const { CrudService } = require('@shared/layers/crud.service');
const { CrudController } = require('@shared/layers/crud.controller');

class LayersService {

  constructor() {
    this.sequelize = sequelize;
    this.models = {};
    this.repositories = {};
    this.services = {};
    this.controllers = {};
  }

  async createModel(DTO) {
    const properties = {};
    for (const prop of DTO.properties) {
      properties[prop.field] = {};
      properties[prop.field].type = DataTypes[prop.type.toUpperCase()];
      properties[prop.field].allowNull = prop.allowNull;
      if (!prop.allowNull) properties[prop.field].validate = { notNull };
    }

    const resourceModel = this.sequelize.define(
      DTO.path,
      properties,
      {
        timestamps: false,
        tableName: DTO.path,
        schema: DTO.tenantId,
      }
    );

    await resourceModel.sync();
    this.models[DTO.path + 'Model'] = resourceModel;

    return resourceModel;
  }

  async createRepository(DTO) {
    const model = await this.createModel(DTO);
    const repository = new CrudRepository(model, { include: { all: true } });
    this.repositories[DTO.path + 'Repository'] = repository;
    return repository;
  }

  async createService(DTO) {
    const repository = await this.createRepository(DTO);
    const service = new CrudService(repository);
    this.services[DTO.path + 'Service'] = service;
    return service;
  }

  async createController(DTO) {
    const service = await this.createService(DTO);
    const controller = new CrudController(service, DTO.path, 'id');
    this.controllers[DTO.path + 'Controller'] = controller;
    return controller;
  }

}

module.exports = new LayersService();
