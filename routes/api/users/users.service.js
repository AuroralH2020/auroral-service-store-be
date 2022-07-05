'use strict';

const usersRepository = require('./users.repository');
const { CrudService } = require('@shared/layers/crud.service');
const hashService = require('./hash.service');

class UsersService extends CrudService {

  constructor(...args) {
    super(...args);
    this.hash = hashService;
  }

  async create(entityDTO, { transactionId, scope = 'defaultScope', ignoreSerialPk = true, createAssociatedEntities = false, updateAssociations = true } = {}) {
    entityDTO.password = await this.hash.hashString(entityDTO.password);
    let newEntity = await this.repository.create(entityDTO, { transactionId, scope, ignoreSerialPk, createAssociatedEntities, updateAssociations });
    return newEntity;
  }

  async update(entityQuery, entityDTO, { transactionId, scope = 'defaultScope', ignoreSerialPk = true } = {}) {
    if (entityDTO.password) entityDTO.password = await this.hash.hashString(entityDTO.password);
    let updatedEntity = await this.repository.update(entityQuery, entityDTO, { transactionId, scope, ignoreSerialPk });
    return updatedEntity;
  }

  async bulkCreate(entitiesDTO, { transactionId, scope = 'defaultScope', ignoreSerialPk = true, updateAssociations = true } = {}) {
    for (const newEntity of entitiesDTO) {
      newEntity.password = await this.hash.hashString(newEntity.password);
    }
    return await this.repository.bulkCreate(entitiesDTO, { transactionId, scope, ignoreSerialPk, updateAssociations });
  }

  async authenticate(username, plainPassword) {
    const user = await this.repository.read({ username }, { scope: null });
    if (!user) return;
    const match = await this.hash.compareStrings(plainPassword, user.password);
    return match ? user : undefined;
  }

}

module.exports = new UsersService(usersRepository);
