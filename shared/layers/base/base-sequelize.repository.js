'use strict';

const { Op, ValidationError } = require('sequelize');
const i18n = require('@config/i18n.config');
const { listLimit } = require('@config');
const sequelizeTransactionsService = require('@shared/services/sequelize-transactions.service');
const eventsService = require('@shared/services/events.service');

class BaseSequelizeRepository {

  constructor(model, options = {}) {
    this.model = model;
    this.Op = Op;
    this.i18n = i18n;
    this.listLimit = listLimit;
    this.transactions = sequelizeTransactionsService;
    this.events = eventsService;
    this.options = {
      include: { all: true },
      includeOnList: undefined,
      includeOnRead: undefined,
      includeOnCreate: undefined,
      includeOnUpdate: undefined,
      includeOnDelete: undefined,
      operatorSeparator: '$'
    };

    for (const key in this.options) {
      if (options[key]) this.options[key] = options[key];
    }

    this.operators = [
      // Basics
      'eq', 'ne', 'is', 'not', 'or',
      // Comparisons
      'gt', 'gte', 'lt', 'lte', 'between', 'notBetween',
      // Other operators
      'in', 'notIn', 'like', 'notLike', 'startsWith', 'endsWith', 'substring', 'iLike', 'notILike',
      'regexp', 'notRegexp', 'iRegexp', 'notIRegexp'
    ];

    const includesToLoad = [];
    for (const key of ['include', 'includeOnList', 'includeOnRead', 'includeOnCreate', 'includeOnUpdate', 'includeOnDelete']) {
      if (this.hasModelsToLoad(this.options[key])) includesToLoad.push(key);
    }

    if (includesToLoad.length > 0) {
      this.events.once('models loaded', () => {
        includesToLoad.forEach(key => this.options[key] = this.loadIncludeModels(this.options[key]));
      });
    }

  }

  hasModelsToLoad(include) {
    if (!include) return false;
    if (!Array.isArray(include)) include = [include];
    for (const item of include) {
      if (item.constructor?.name === 'Object') {
        if (item.model && typeof item.model === 'string') return true;
        if (item.include && this.hasModelsToLoad(item.include)) return true;
      }
    }
    return false;
  }

  loadIncludeModels(include) {
    if (!include) return;
    if (!Array.isArray(include)) include = [include];
    for (const item of include) {
      if (item.constructor?.name === 'Object') {
        if (item.model && typeof item.model === 'string') item.model = this.model.sequelize.model(item.model);
        if (item.include) item.include = this.loadIncludeModels(item.include);
      }
    }
    return include;
  }

  //* For further development
  parseDotNotedKey(dotNotedKey, model) {
    if (!dotNotedKey.includes('.')) return;
    const [field, subfield, ...rest] = dotNotedKey.split('.');
    if (!model.associations[field]) return;
    const childModel = model.associations[field].target;
    if (!Object.keys(childModel.associations).includes(subfield)) return;
    if (rest.length === 0) {
      return { model: childModel, include: subfield };
    } else {
      return { model: childModel, include: this.parseDotNotedKey([subfield, ...rest].join('.'), childModel) };
    }
  }

  //* For further development
  createDotNotedInclude(include) {
    const dotNotedInclude = [];
    if (!Array.isArray(include)) include = [include];
    for (const item of include) {
      if (item.all === true) {
        dotNotedInclude.push(...this.getAssociationAttributes());
      } else if (typeof item === 'string') {
        dotNotedInclude.push(item);
      } else if (Object.getPrototypeOf(item).name === 'Model') {
        dotNotedInclude.push(Object.keys(this.model.associations)
          .find(assoc => this.model.associations[assoc].target.name === item.name));
      } else if (item.model) {
        let field = Object.keys(this.model.associations)
          .find(assoc => this.model.associations[assoc].target.name === item.model.name);
        if (item.include) field += '.' + this.createDotNotedInclude(item.include);
        dotNotedInclude.push(field);
      }
    }
    return dotNotedInclude;
  }

  filterInclude(dotNotedKey, value, model, include) {
    // If a where property is set to filter an array of entities, it will be set to true
    let hasFilteredArray = false;
    if (!dotNotedKey.includes('.')) return { include, hasFilteredArray };
    const [field, subfield, ...rest] = dotNotedKey.split('.');

    if (!model.associations[field]) return { include, hasFilteredArray };
    const childModel = model.associations[field].target;

    if (!Array.isArray(include)) include = [include];
    // Make a shallow copy of original include
    include = include.map(item => item.constructor?.name === 'Object' ? { ...item } : item);

    if (rest.length === 0) {
      if (!Object.keys(childModel.rawAttributes).includes(subfield)) return { include, hasFilteredArray };
      let includeEntry = include.find(item => item.model?.name === childModel.name);
      if (includeEntry) {
        if (includeEntry.where) {
          includeEntry.where[subfield] = value;
        } else {
          includeEntry.where = { [subfield]: value };
        }
        if (['hasMany', 'belongsToMany'].includes(model.associations[field].associationType)) hasFilteredArray = true;
      } else {
        includeEntry = include.find(item => item.all === true || item === field || item.name === childModel.name);
        if (includeEntry) {
          if (includeEntry === field) {
            include = include.filter(item => item !== field);
          } else if (includeEntry.name === childModel.name) {
            include = include.filter(item => item.name !== childModel.name);
          }
          include.push({ model: childModel, where: { [subfield]: value } });
          if (['HasMany', 'BelongsToMany'].includes(model.associations[field].associationType)) hasFilteredArray = true;
        }
      }
      return { include, hasFilteredArray };
    } else {
      if (!Object.keys(childModel.associations).includes(subfield)) return { include, hasFilteredArray };
      const includeEntry = include.find(item => item.model?.name === childModel.name && item.include);
      if (includeEntry) {
        const result = this.filterInclude([subfield, ...rest].join('.'), value, childModel, includeEntry.include);
        includeEntry.include = result.include;
        hasFilteredArray = result.hasFilteredArray;
      }
      return { include, hasFilteredArray };
    }
  }

  parseAttribute(key, value) {
    if (!key.includes(this.options.operatorSeparator)) return { parsedKey: key, parsedValue: value };
    const [parsedKey, operator] = key.split(this.options.operatorSeparator);
    if (!this.operators.includes(operator)) return;
    if (['or', 'between', 'notBetween', 'in', 'notIn'].includes(operator) &&
      !Array.isArray(value)) value = value.split(',');
    return { parsedKey, parsedValue: { [this.Op[operator]]: value } };
  }

  setOptions(entityQuery = {}, entityQueryOptions = {}) {
    const options = {};
    let hasFilteredArray = false;
    let include = this.options.includeOnList || this.options.include || [];
    if (!Array.isArray(include)) include = [include];

    // Make a shallow copy of original include
    options.include = include.map(item => item.constructor?.name === 'Object' ? { ...item } : item);

    for (const key in entityQuery) {
      const parsedAttribute = this.parseAttribute(key, entityQuery[key]);
      if (parsedAttribute) {
        const { parsedKey, parsedValue } = parsedAttribute;
        if (!key.includes('.')) {
          if (this.getAttributes().includes(parsedKey)) {
            if (options.where) {
              options.where[parsedKey] = parsedValue;
            } else {
              options.where = { [parsedKey]: parsedValue };
            }
          }
        } else {
          const result = this.filterInclude(parsedKey, parsedValue, this.model, options.include);
          options.include = result.include;
          hasFilteredArray = result.hasFilteredArray;
        }
      }
    }

    options.order = entityQueryOptions.order?.split(',').map(orderItem => {
      const column = orderItem.startsWith('-') ? orderItem.substring(1) : orderItem;
      const direction = orderItem.startsWith('-') ? 'DESC' : 'ASC';
      return [column, direction];
    });

    // If include option is empty, not nested entities will be loaded
    // Therefore, limit and offset can be applied to the query
    if (options.include.length === 0) {
      options.limit = entityQueryOptions.limit || this.listLimit;
      options.offset = entityQueryOptions.offset;
    }
    // Otherwise, only the safety limit value will be applied to the query
    else {
      options.limit = this.listLimit;
    }

    return { options, hasFilteredArray };

  }

  async list(entityQuery = {}, entityQueryOptions = {}, { transactionId, scope = 'defaultScope' } = {}) {
    const { options, hasFilteredArray } = this.setOptions(entityQuery, entityQueryOptions);

    let entities = await this.model.scope(scope).findAll({
      ...options,
      transaction: this.transactions.get(transactionId)
    });

    // If filtering options included a where property in an include object for HasMany or
    // BelongsToMany associations, the included results from this nested array are filtered and incomplete
    // Therefore, a new query is sent requesting the list of entity IDs retrieved from the first query
    // and using the original include property without where properties
    if (hasFilteredArray) {
      const primaryKeyName = Object.keys(this.model.primaryKeys)[0];

      entities = await this.model.scope(scope).findAll({
        where: { [primaryKeyName]: { [this.Op.in]: entities.map(entity => entity[primaryKeyName]) } },
        include: this.options.includeOnCreate || this.options.include,
        order: options.order,
        transaction: this.transactions.get(transactionId)
      });
    }

    entities = entities.map(entity => entity.toJSON());

    // If nested entities were fetched from DB,
    // limit and order were ommited to avoid misleading results
    // They are now applied here on the resulting JSON
    if (options.include.length > 0) {
      const { offset, limit } = entityQueryOptions;
      const start = offset || 0;
      const end = start + (limit || this.listLimit);
      entities = entities.slice(start, end);
    }

    return entities;
  }

  async read(entityQuery, { transactionId, scope = 'defaultScope' } = {}) {
    const entity = await this.model.scope(scope).findOne({
      where: entityQuery,
      include: this.options.includeOnRead || this.options.include,
      transaction: this.transactions.get(transactionId)
    });
    return entity ? entity.toJSON() : entity;
  }

  async create(entityDTO, { transactionId, scope = 'defaultScope', ignoreSerialPk = true, createAssociatedEntities = false, updateAssociations = true } = {}) {
    // Get auto incremental primary key, if exists
    const serialPk = Object.keys(entityDTO).find(attr => this.model.primaryKeys[attr]?.autoIncrement);
    // If DTO includes an auto incremental primary key, delete it if enabled
    if (serialPk && ignoreSerialPk) delete entityDTO[serialPk];

    const associationAttributes = this.getAssociationAttributes();
    if (!createAssociatedEntities) {
      for (const key in entityDTO) {
        // Delete DTO keys that are objects (nested entity representations)
        if (associationAttributes.includes(key) && entityDTO[key].constructor?.name === 'Object') {
          delete entityDTO[key];
        }
      }
    }

    let newEntity;
    try {
      newEntity = await this.model.create(entityDTO, {
        transaction: this.transactions.get(transactionId)
      });
    } catch (err) {
      if (err instanceof ValidationError) {
        // Return a translated error message instead of a Sequelize error object to keep layers separated
        const message = this.createValidationErrorMessage(err);
        throw new Error(message);
      } else {
        throw new Error(err.message);
      }
    }

    // If DTO includes an auto incremental primary key and was not ignored, set correct current max value
    if (serialPk && !ignoreSerialPk) await this.setSerialSequence();

    const primaryKeyName = Object.keys(this.model.primaryKeys)[0];

    newEntity = await this.model.scope(scope).findOne({
      where: { [primaryKeyName]: newEntity[primaryKeyName] },
      include: this.options.includeOnCreate || this.options.include,
      transaction: this.transactions.get(transactionId)
    });

    if (!newEntity) throw new Error(`Entity '${entityDTO[primaryKeyName] ||
      entityDTO[Object.keys(entityDTO)[0]]}' could not be created`);

    // If associations were defined for the model,
    // update the associated fields
    if (updateAssociations && Object.keys(entityDTO)
      .some(key => associationAttributes.includes(key) &&
        (['number', 'string'].includes(typeof entityDTO[key]) ||
          entityDTO[key].constructor?.name == 'Array'))) {
      if (createAssociatedEntities) {
        for (const key in entityDTO) {
          // Delete DTO keys that are objects (nested entity representations)
          if (associationAttributes.includes(key) && entityDTO[key].constructor?.name === 'Object') {
            delete entityDTO[key];
          }
        }
      }
      newEntity = await this.updateAssociations(newEntity, entityDTO, transactionId);
    }

    return newEntity.toJSON();
  }

  async update(entityQuery, entityDTO, { transactionId, scope = 'defaultScope', ignoreSerialPk = true } = {}) {
    // Get auto incremental primary key, if exists
    const serialPk = Object.keys(entityDTO).find(attr => this.model.primaryKeys[attr]?.autoIncrement);
    // If DTO includes an auto incremental primary key, ignore it if enabled
    if (serialPk && ignoreSerialPk) delete entityDTO[serialPk];

    try {
      await this.model.update(entityDTO, {
        where: entityQuery,
        transaction: this.transactions.get(transactionId)
      });
    } catch (err) {
      if (err instanceof ValidationError) {
        // Return a translated error message instead of a Sequelize error object to keep layers separated
        const message = this.createValidationErrorMessage(err);
        throw new Error(message);
      } else {
        throw new Error(err.message);
      }
    }

    // If DTO includes an auto incremental primary key and was not ignored, set correct current max value
    if (serialPk && !ignoreSerialPk) await this.setSerialSequence();

    // If update action has modified entity query fields,
    // update entityQuery object to be able to retrieve and return an entity
    for (const key in entityDTO) {
      if (Object.hasOwnProperty.call(entityQuery, key)) entityQuery[key] = entityDTO[key];
    }

    let updatedEntity = await this.model.scope(scope).findOne({
      where: entityQuery,
      include: this.options.includeOnUpdate || this.options.include,
      transaction: this.transactions.get(transactionId)
    });

    const primaryKeyName = Object.keys(this.model.primaryKeys)[0];
    if (!updatedEntity) throw new Error(`Entity ${entityQuery[primaryKeyName]} does not exist`);

    // If associations were defined for the model,
    // update the associated fields
    const associationAttributes = this.getAssociationAttributes();
    if (Object.keys(entityDTO)
      .some(key => associationAttributes.includes(key) &&
        (['number', 'string'].includes(typeof entityDTO[key]) ||
          entityDTO[key].constructor?.name == 'Array'))) {
      updatedEntity = await this.updateAssociations(updatedEntity, entityDTO, transactionId);
    }
    return updatedEntity.toJSON();
  }

  async delete(entityQuery, { transactionId, scope = 'defaultScope' } = {}) {
    const deletedEntity = await this.model.scope(scope).findOne({
      where: entityQuery,
      include: this.options.includeOnDelete || this.options.include,
      transaction: this.transactions.get(transactionId)
    });
    await this.model.destroy({ where: entityQuery, transaction: this.transactions.get(transactionId) });
    return deletedEntity ? deletedEntity.toJSON() : deletedEntity;
  }

  async count(entityQuery = {}, { transactionId, scope = 'defaultScope' } = {}) {

    const result = this.setOptions(entityQuery);

    // If no nested entities were fetched from DB,
    // count() method will count table records
    if (result.options.include.length === 0) {
      return this.model.count({ where: result.options.where, transaction: this.transactions.get(transactionId) });
    }
    // Otherwise, count() method does not work well with include option 
    // to just count table records, since it will count nested entities
    // Length of findAll() result will be sent instead.
    else {
      const entities = await this.model.scope(scope).findAll({
        ...result.options,
        transaction: this.transactions.get(transactionId)
      });
      return entities.map(entity => entity.toJSON()).length;
    }

  }

  async validate(entityDTO, partialValidation, locale = this.i18n.getLocale()) {
    try {
      const builtEntity = this.model.build(entityDTO);
      const options = partialValidation ? { fields: Object.keys(entityDTO) } : undefined;
      const validationResult = await builtEntity.validate(options);
      return validationResult;
    } catch (err) {
      if (err instanceof ValidationError) {
        // Return a translated error message instead of a Sequelize error object to keep layers separated
        const message = this.createValidationErrorMessage(err, locale);
        return message;
      } else {
        throw new Error(err.message);
      }
    }
  }

  createValidationErrorMessage(err, locale = this.i18n.getLocale()) {
    return err.errors.map(error => ({
      field: error.path,
      message: error.message,
      args: Array.isArray(error.validatorArgs)
        ? error.validatorArgs.toString().split(',').join(', ')
        : error.validatorArgs
    }))
      .map(error => this.i18n.__({ phrase: error.message, locale }, { field: error.field, args: error.args })).join('. ');
  }

  async bulkCreate(entitiesDTO, { transactionId, scope = 'defaultScope', ignoreSerialPk = true, updateAssociations = true } = {}) {
    if (ignoreSerialPk) {
      for (const entityDTO of entitiesDTO) {
        // Get auto incremental primary key, if exists
        const serialPk = Object.keys(entityDTO).find(attr => this.model.primaryKeys[attr]?.autoIncrement);
        // If DTO includes an auto incremental primary key, ignore it if enabled
        if (serialPk) delete entityDTO[serialPk];
      }
    }

    let newEntities = await this.model.bulkCreate(entitiesDTO, {
      validate: true,
      ignoreDuplicates: true,
      transaction: this.transactions.get(transactionId)
    });

    // If DTO includes an auto incremental primary key and was not ignored, set correct current max value
    if (!ignoreSerialPk && entitiesDTO
      .some(entityDTO => Object.keys(entityDTO).find(attr => this.model.primaryKeys[attr]?.autoIncrement))
    ) await this.setSerialSequence();

    const primaryKeyName = Object.keys(this.model.primaryKeys)[0];

    newEntities = await this.model.scope(scope).findAll({
      where: { [primaryKeyName]: { [this.Op.in]: newEntities.map(entity => entity[primaryKeyName]) } },
      include: this.options.includeOnCreate || this.options.include,
      transaction: this.transactions.get(transactionId)
    });

    const associationAttributes = this.getAssociationAttributes();

    // If associations were defined for the model,
    // update the associated fields
    if (updateAssociations &&
      entitiesDTO.some(entityDTO => {
        return Object.keys(entityDTO)
          .some(key => associationAttributes.includes(key) &&
            (['number', 'string'].includes(typeof entityDTO[key]) ||
              entityDTO[key].constructor?.name == 'Array'));
      })) {
      newEntities = await Promise.all(newEntities.map(entity => {
        const entityDTO = entitiesDTO.find(DTO => DTO[primaryKeyName] === entity[primaryKeyName]);
        return this.updateAssociations(entity, entityDTO, transactionId);
      }));
    }

    return newEntities.map(entity => entity.toJSON());
  }

  async updateAssociations(entity, entityDTO, transactionId) {
    const associationAttributes = this.getAssociationAttributes();
    for (const key in entityDTO) {
      if (associationAttributes.includes(key)) {
        const capitalizedKey = key.charAt(0).toUpperCase() + key.slice(1);
        if (
          Array.isArray(entityDTO[key]) && entityDTO[key].length > 0 &&
          entityDTO[key].every(item => Array.isArray(item) && item.length === 2)
        ) {
          for (const [index, item] of entityDTO[key].entries()) {
            const [associatedEntityId, additionalAttributes] = item;
            if (index === 0) {
              await entity[`set${capitalizedKey}`](associatedEntityId, {
                through: additionalAttributes,
                validate: true,
                transaction: this.transactions.get(transactionId)
              });
            } else {
              await entity[`add${capitalizedKey}`](associatedEntityId, {
                through: additionalAttributes,
                validate: true,
                transaction: this.transactions.get(transactionId)
              });
            }
          }
        } else {
          await entity[`set${capitalizedKey}`](entityDTO[key]);
        }
      }
    }
    await entity.reload();

    return entity;
  }

  getAttributes() {
    return Object.keys(this.model.rawAttributes);
  }

  getAssociationAttributes() {
    return Object.keys(this.model.associations);
  }

  changeTenant(tenantName) {
    if (tenantName === 'admin') return;
    const schemasToKeep = [tenantName, 'admin'];
    for (const modelName in this.model.sequelize.models) {
      const model = this.model.sequelize.model(modelName);
      if (!schemasToKeep.includes(model._schema)) model._schema = tenantName;
    }
  }

  getTenant() {
    return this.model.getTableName().schema;
  }

  hasTenantIdField() {
    return (this.model.rawAttributes.tenantId);
  }

  startTransaction() {
    return this.transactions.start();
  }

  commitTransaction(transactionId) {
    this.transactions.commit(transactionId);
  }

  rollbackTransaction(transactionId) {
    this.transactions.rollback(transactionId);
  }

  async setSerialSequence() {
    const serialPk = Object.keys(this.model.rawAttributes)
      .find(attr => this.model.rawAttributes[attr].primaryKey && this.model.rawAttributes[attr].autoIncrement);
    const { schema, delimiter, tableName } = this.model.getTableName();
    await this.model.sequelize
      .query(`SELECT setval('${schema}${delimiter}"${tableName}_${serialPk}_seq"', (SELECT MAX(${serialPk}) from "${schema}"${delimiter}"${tableName}"))`);
  }

}

exports.BaseSequelizeRepository = BaseSequelizeRepository;
exports.createRepository = (model) => new BaseSequelizeRepository(model);
