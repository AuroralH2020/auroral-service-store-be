'use strict';

class BaseCrudService {

  constructor(repository) {
    this.repository = repository;
  }

  async list(entityQuery = {}, entityQueryOptions = {}, { transactionId, scope = 'defaultScope' } = {}) {
    let entities = await this.repository.list(entityQuery, entityQueryOptions, { transactionId, scope });
    return entities;
  }

  async read(entityQuery, { transactionId, scope = 'defaultScope' } = {}) {
    let entity = await this.repository.read(entityQuery, { transactionId, scope });
    return entity;
  }

  async create(entityDTO, { transactionId, scope = 'defaultScope', ignoreSerialPk = true, createAssociatedEntities = false, updateAssociations = true } = {}) {
    let newEntity = await this.repository.create(entityDTO, { transactionId, scope, ignoreSerialPk, createAssociatedEntities, updateAssociations });
    return newEntity;
  }

  async update(entityQuery, entityDTO, { transactionId, scope = 'defaultScope', ignoreSerialPk = true } = {}) {
    let updatedEntity = await this.repository.update(entityQuery, entityDTO, { transactionId, scope, ignoreSerialPk });
    return updatedEntity;
  }

  async delete(entityQuery, { transactionId, scope = 'defaultScope' } = {}) {
    let deletedEntity = await this.repository.delete(entityQuery, { transactionId, scope });
    return deletedEntity;
  }

  async count(entityQuery = {}, entityQueryOptions = {}, { transactionId, scope = 'defaultScope' } = {}) {
    let totalEntities = await this.repository.count(entityQuery, entityQueryOptions, { transactionId, scope });
    return totalEntities;
  }

  async validate(entityDTO, partialValidation, locale) {
    return await this.repository.validate(entityDTO, partialValidation, locale);
  }

  async bulkCreate(entitiesDTO, { transactionId, scope = 'defaultScope', ignoreSerialPk = true, updateAssociations = true } = {}) {
    return await this.repository.bulkCreate(entitiesDTO, { transactionId, scope, ignoreSerialPk, updateAssociations });
  }

  getAttributes() {
    return this.repository.getAttributes();
  }

  getAssociationAttributes() {
    return this.repository.getAssociationAttributes();
  }

  changeTenant(tenantName) {
    this.repository.changeTenant(tenantName);
  }

  getTenant() {
    return this.repository.getTenant();
  }

  hasTenantIdField() {
    return this.repository.hasTenantIdField();
  }

}

exports.BaseCrudService = BaseCrudService;
exports.createService = (repository) => new BaseCrudService(repository);
