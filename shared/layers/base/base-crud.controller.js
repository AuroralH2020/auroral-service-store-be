'use strict';

const { Router } = require('express');
const httpErrorsService = require('@shared/services/http-errors.service');
const eventsService = require('@shared/services/events.service');
const { listLimit, isApiSecured, isMultitenantEnabled, isMultitenantSeparate } = require('@config');

/**
 * CrudController class
 * 
 * Constructor:
 * @param {Object} service      Instance of CrudService class
 * @param {string} path         Path name to be used
 * @param {string} idField      Name of the field to be used as entities identifier. It must be equal to ID in DB
 * 
 * @param {sbject} [options]    (Optional) Controller options
 * 
 * @param {string} [options.entityName]       Name in SINGULAR to be used in response messages (by default, path without final 's', spaces instead hyphens and first letter capitalized)
 * @param {string} [options.gender='male']    (Optional) Entity gender for translated response messages: 'male' or 'female'
 * @param {string[]} [options.roles=['any']]  (Optional) Roles that have access to controller actions and additional actions, unless specific roles are set for them
 * 
 * @param {Array<string | Object>} [options.actions=['list', 'read', 'create', 'update', 'delete']] (Optional) CRUD actions to include
 * @param {string}                 options.actions.name   Action name: 'list', 'read', 'create', 'update', 'delete'
 * @param {string[]}               options.actions.roles  Roles allowed to perform the action
 * 
 * @param {string[]} [options.filters=['order', 'limit', 'offset']] (Optional) Filters allowed in query params
 * 
 * @param {Object[]}   [options.additionalActions=[]]                                         (Optional) Additional actions to include
 * @param {string}     options.additionalActions.name                                         Custom action name
 * @param {string}     options.additionalActions.method                                       HTTP method
 * @param {string[]}   [options.additionalActions.middlewares=[options.additionalActions.name]] (Optional) Name of class methods to be executed for this path
 * @param {string[]}   [options.additionalActions.roles=options.roles]                        (Optional) Roles allowed to perform the action 
 * @param {string}     [options.additionalActions.path=options.additionalActions.name]        (Optional) Path name to be used (instead of action name)
 * 
 * @param {Function} [options.mapEntity=undefined] (Optional) Function that returns the final entity object that will be sent as response
 * 
 * @param {Object[]} [options.children=[]]       (Optional) Nested controllers
 * @param {Object}   options.children.controller Instance of CrudController
 * @param {string}   options.children.filterKey Name of the filter key in nested controller that link with parent controller. It may be equal to a foreign key in model or a nested key from an associated model (i.e. users.id)
 */

class BaseCrudController {

  constructor(service, path, idField, options = {}) {
    this._router;

    // Arguments
    this.service = service;
    this.path = '/' + path;
    this.idField = idField;

    // Services
    this.httpErrors = httpErrorsService;
    this.events = eventsService;

    // Env variables
    this.listLimit = listLimit;
    this.isMultitenantEnabled = isMultitenantEnabled;
    this.isMultitenantSeparate = isMultitenantSeparate;
    this.isApiSecured = isApiSecured;

    // Options
    // Default values
    this.crudActionsMethods = {
      list: 'get',
      read: 'get',
      create: 'post',
      update: 'patch',
      delete: 'delete'
    };

    this.crudActions = Object.keys(this.crudActionsMethods);

    this.options = {
      entityName: path
        .charAt(0).toUpperCase() + path.toLowerCase().slice(1).replace(/s$/, '').replace(/-/g, ' '),
      gender: 'male',
      roles: ['any'],
      actions: this.crudActions, // Array of strings or objects: { name: string, roles: string[] }
      filters: ['limit', 'offset', 'order'],
      additionalActions: [], // Array of objects: { name: string, method: string (HTTP method), middlewares: Function[] (class method), roles?: string[], path?: string }
      mapEntity: undefined,
      children: [] // Array of objects: { controller: childController, filterKey: string }
    };

    for (const key in this.options) {
      if (options[key]) this.options[key] = options[key];
    }

    this.entityName = this.options.entityName;
    this.pluralizedEntityName = path
      .charAt(0).toUpperCase() + path.slice(1).toLowerCase().replace(/-/g, ' ');

    this.initRoutes();

    if (this.options.children.length > 0) {
      this.options.children.forEach(child => {
        if (['controller', 'filterKey'].every(prop => Object.hasOwnProperty.call(child, prop))) {
          // Replace dots with double underscores to make param name valid for Express
          // Double underscores are not expected to be used as actual model fields
          this._router.use(`/:${child.filterKey.split('.').join('__')}${child.controller.path}`, [
            function (req, res, next) {
              for (let key in req.params) {
                // Replace double underscores with dots to recover original filter key names
                if (key.includes('__')) {
                  req.params[key.split('__').join('.')] = req.params[key];
                  delete req.params[key];
                }
              }
              if (req.previousParams) {
                const previousParams = {};
                for (const key in req.previousParams) {
                  let renamedKey = key;
                  if (key.includes('.')) {
                    const fieldName = Object.keys(req.params)[0].split('.')[0];
                    renamedKey = `${fieldName}.${key}`;
                  }
                  previousParams[renamedKey] = req.previousParams[key];
                }
                req.previousParams = { ...req.previousParams, ...req.params };
              } else {
                req.previousParams = req.params;
              }
              next();
            },
            child.controller.getRouter()
          ]);
        } else {
          console.error('Wrong child config item:', child);
        }
      });
    }
  }

  clone(controllerInstance) {
    const { service, path, idField, options } = controllerInstance;
    return new controllerInstance.constructor(service, path.substring(1,), idField, options);
  }

  get router() {
    return this._router;
  }

  getRouter() {
    return this.router;
  }

  notFoundMessage(id, mf) {
    const entity = mf(this.entityName);
    return mf('{entity} {id} not {GENDER, select, male {found} female {found} other {found}}',
      { entity, id, GENDER: this.options.gender || 'male' });
  }

  alreadyExistsMessage(id, mf) {
    const entity = mf(this.entityName);
    return mf('{entity} {id} already exists',
      { entity, id });
  }

  successMessage(id, action, mf, bulk = false) {
    if (bulk) {
      const entities = mf(this.pluralizedEntityName);
      return mf(`{entities} were successfully {GENDER, select, male {${action}} female {${action}} other {${action}}} in bulk`,
        { entities, GENDER: this.options.gender || 'male' });
    }
    const entity = mf(this.entityName);
    return mf(`{entity} {id} was successfully {GENDER, select, male {${action}} female {${action}} other {${action}}}`,
      { entity, id, GENDER: this.options.gender || 'male' });
  }

  mapEntity(entity, req, res) {
    return this.options.mapEntity ? this.options.mapEntity(entity, req, res) : entity;
  }

  mapEntities(entities, req, res) {
    return this.options.mapEntity ? entities.map(entity => this.options.mapEntity(entity, req, res)) : entities;
  }

  initRoutes() {
    const actionsConfig = this.options.additionalActions.reduce((actionsArray, action) => {
      // If an additional action passed is a valid object with not duplicated name,
      // add to actions config defining method, path, middlewares and roles
      if (typeof action === 'object' &&
        // Check if mandatory fields are present
        ['name', 'method'].every(prop => Object.hasOwnProperty.call(action, prop)) &&
        // Check if action name is valid
        !this.crudActions.includes(action.name) &&
        // Check if name is not duplicated
        !actionsArray.some(actionItem => {
          if (typeof actionItem === 'string') return actionItem === action.name;
          if (typeof actionItem === 'object') return actionItem.name === action.name;
        })) {
        actionsArray.push({
          name: action.name, // string
          method: action.method.toLowerCase(), // string from: 'get', 'post', 'patch', 'delete', 'put', 'all'...
          middlewares: action.middlewares || [action.name], // (Optional) Array of methods names (if undefined, it equals name)
          roles: action.roles || this.options.roles, // (Optional) Roles allowed (if undefined, route roles are set)
          path: action.path || action.name // (Optional) Route path (if undefined, it equals name)
        });
      } else {
        console.error('Wrong action config item:', action);
      }
      return actionsArray;
    }, [])
      .concat(this.options.actions.reduce((actionsArray, action) => {
        // If action passed is a valid string with not duplicated name, add to actions config assigning it route roles
        if (typeof action === 'string' &&
          // Check if action name is valid
          this.crudActions.includes(action) &&
          // Check if name is not duplicated
          !actionsArray.some(actionItem => {
            if (typeof actionItem === 'string') return actionItem === action;
            if (typeof actionItem === 'object') return actionItem.name === action;
          })) {
          actionsArray.push({ name: action, roles: this.options.roles });
        }
        // If action is a valid object with not duplicated name, add to actions config assigning it specific roles
        else if (typeof action === 'object' &&
          // Check if mandatory fields are present
          ['name', 'roles'].every(prop => Object.hasOwnProperty.call(action, prop)) &&
          // Check if action name is valid
          this.crudActions.includes(action.name) &&
          // Check if name is not duplicated
          !actionsArray.some(actionItem => {
            if (typeof actionItem === 'string') return actionItem === action.name;
            if (typeof actionItem === 'object') return actionItem.name === action.name;
          })) {
          actionsArray.push({ name: action.name, roles: action.roles });
        } else {
          console.error('Wrong action config item:', action);
        }
        return actionsArray;
      }, []));

    this._router = Router();
    this._router.use((async (req, res, next) => {
      if (this.isMultitenantEnabled) {
        if (!req.tenant) throw this.httpErrors.create(401, res.__('Tenant not provided'));
        if (this.isMultitenantSeparate) {
          if (req.tenant !== this.service.getTenant()) this.httpErrors.create(404, 'Not Found');
        } else {
          if (this.service.getTenant() !== 'admin') this.service.changeTenant(req.tenant);
        }
      }
      req.actionsConfig = actionsConfig;
      req.isNested = (req.previousParams);
      next();
    }).bind(this));

    for (const action of actionsConfig) {
      if (this.crudActions.includes(action.name)) {
        const method = this.crudActionsMethods[action.name];
        const path = (['list', 'create']).includes(action.name) ? '/' : `/:${this.idField}`;
        const middlewares = [this.getGuardMiddleware(action.name).bind(this)];
        if ((['create', 'update']).includes(action.name)) middlewares.push(this.validateDTO.bind(this));
        middlewares.push(this[action.name].bind(this));
        this._router[method](path, middlewares);
      } else {
        this._router[action.method](`/${action.path}`, [
          this.getGuardMiddleware(action.name).bind(this),
          ...action.middlewares.map(middleware => this[middleware].bind(this))]);
      }
    }
  }

  async list(req, res, next) {
    try {
      const entityQuery = req.previousParams
        ? { ...req.previousParams, ...req.params }
        : req.params;
      if (this.isMultitenantEnabled &&
        this.service.getTenant() === 'admin' &&
        this.service.hasTenantIdField() &&
        this.isApiSecured && !req.isSuperAdmin) {
        entityQuery.tenantId = req.tenant;
      }
      let entityQueryOptions = {};
      for (const key in req.query) {
        if (this.options.filters.includes(key)) {
          // Parse limit and offset to integers, if possible. Otherwise, remove them
          if (['limit', 'offset'].includes(key)) {
            req.query[key] = Number.isInteger(Number(req.query[key])) ? parseInt(req.query[key]) : undefined;
          }
          entityQueryOptions[key] = req.query[key];
        } else {
          entityQuery[key] = req.query[key];
        }
      }
      const entities = await this.service.list(entityQuery, entityQueryOptions);
      const count = await this.service.count(entityQuery, entityQueryOptions);
      const total = (this.listLimit && count > this.listLimit) || req.query.limit
        ? count
        : undefined;
      const sent = total ? entities.length : undefined;
      const result = this.mapEntities(entities, req, res);
      ['response', `${this.entityName.toLowerCase()} response`, 'list', `${this.entityName.toLowerCase()} list`]
        .forEach(event => this.events.emit(event, result, req, res));
      res.json({
        success: true,
        total,
        sent,
        result
      });
    } catch (err) {
      ['error response', `${this.entityName.toLowerCase()} error`, 'list error', `${this.entityName.toLowerCase()} list error`]
        .forEach(event => this.events.emit(event, err));
      next(err);
    }
  }

  async read(req, res, next) {
    try {
      const entityQuery = req.previousParams
        ? { ...req.previousParams, ...req.params }
        : req.params;
      if (this.isMultitenantEnabled &&
        this.service.getTenant() === 'admin' &&
        this.service.hasTenantIdField() &&
        this.isApiSecured && !req.isSuperAdmin) {
        entityQuery.tenantId = req.tenant;
      }
      const entity = await this.service.read(entityQuery);
      if (!entity) throw this.httpErrors.create(404, this.notFoundMessage(entityQuery[this.idField], res.__mf));
      const result = this.mapEntity(entity, req, res);
      ['response', `${this.entityName.toLowerCase()} response`, 'read', `${this.entityName.toLowerCase()} read`]
        .forEach(event => this.events.emit(event, result, req, res));
      res.json({
        success: true,
        result
      });
    } catch (err) {
      ['error response', `${this.entityName.toLowerCase()} error`, 'read error', `${this.entityName.toLowerCase()} read error`]
        .forEach(event => this.events.emit(event, err));
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const entityDTO = req.body;
      // If an id field is provided in body, check if this entity already exists
      if (entityDTO[this.idField]) {
        const entityQuery = { [this.idField]: entityDTO[this.idField] };
        const entity = await this.service.read(entityQuery);
        if (entity) throw this.httpErrors.create(400, this.alreadyExistsMessage(entityDTO[this.idField], res.__mf));
      }
      // If request params object is not empty, this is a nested path and params may be foreign keys
      // They have to be added to DTO to set or overwrite foreign keys values, avoiding misleading resource creations
      if (Object.keys(req.params).length > 0) {
        for (const key in req.params) {
          // Add key to DTO only if it is a foreign key, not a key nested with dot notation
          if (!key.includes('.')) entityDTO[key] = req.params[key];
        }
      }
      if (this.isMultitenantEnabled &&
        this.service.getTenant() === 'admin' &&
        this.service.hasTenantIdField() &&
        this.isApiSecured && !req.isSuperAdmin) {
        entityDTO.tenantId = req.tenant;
      }
      const newEntity = await this.service.create(entityDTO);
      const result = this.mapEntity(newEntity, req, res);
      ['response', `${this.entityName.toLowerCase()} response`, 'create', `${this.entityName.toLowerCase()} create`]
        .forEach(event => this.events.emit(event, result, req, res));
      res.json({
        success: true,
        message: this.successMessage(newEntity[this.idField], 'created', res.__mf),
        result
      });
    } catch (err) {
      ['error response', `${this.entityName.toLowerCase()} error`, 'create error', `${this.entityName.toLowerCase()} create error`]
        .forEach(event => this.events.emit(event, err));
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const entityQuery = req.previousParams
        ? { ...req.previousParams, ...req.params }
        : req.params;
      const entityDTO = req.body;
      if (this.isMultitenantEnabled &&
        this.service.getTenant() === 'admin' &&
        this.service.hasTenantIdField() &&
        this.isApiSecured && !req.isSuperAdmin) {
        entityQuery.tenantId = req.tenant;
      }
      const entity = await this.service.read(entityQuery);
      if (!entity) throw this.httpErrors.create(404, this.notFoundMessage(entityQuery[this.idField], res.__mf));
      const updatedEntity = await this.service.update(entityQuery, entityDTO);
      const result = this.mapEntity(updatedEntity, req, res);
      ['response', `${this.entityName.toLowerCase()} response`, 'update', `${this.entityName.toLowerCase()} update`]
        .forEach(event => this.events.emit(event, result, req, res));
      res.json({
        success: true,
        message: this.successMessage(updatedEntity[this.idField], 'updated', res.__mf),
        result
      });
    } catch (err) {
      ['error response', `${this.entityName.toLowerCase()} error`, 'update error', `${this.entityName.toLowerCase()} update error`]
        .forEach(event => this.events.emit(event, err));
      next(err);
    }
  }

  async delete(req, res, next) {
    try {
      const entityQuery = req.previousParams
        ? { ...req.previousParams, ...req.params }
        : req.params;
      if (this.isMultitenantEnabled &&
        this.service.getTenant() === 'admin' &&
        this.service.hasTenantIdField() &&
        this.isApiSecured && !req.isSuperAdmin) {
        entityQuery.tenantId = req.tenant;
      }
      const deletedEntity = await this.service.delete(entityQuery);
      if (!deletedEntity) throw this.httpErrors.create(404, this.notFoundMessage(entityQuery[this.idField], res.__mf));
      const result = this.mapEntity(deletedEntity, req, res);
      ['response', `${this.entityName.toLowerCase()} response`, 'delete', `${this.entityName.toLowerCase()} delete`]
        .forEach(event => this.events.emit(event, result, req, res));
      res.json({
        success: true,
        message: this.successMessage(deletedEntity[this.idField], 'deleted', res.__mf),
        result
      });
    } catch (err) {
      ['error response', `${this.entityName.toLowerCase()} error`, 'delete error', `${this.entityName.toLowerCase()} delete error`]
        .forEach(event => this.events.emit(event, err));
      next(err);
    }
  }

  getGuardMiddleware(actionName) {
    return function (req, res, next) {
      try {
        req.actionName = actionName;
        const routeConfig = req.actionsConfig.find(action => action.name === actionName);
        if (!this.isApiSecured ||
          (this.isApiSecured && (
            routeConfig.roles.includes('any') ||
            req.isSuperAdmin ||
            req.isAuthenticated && (
              routeConfig.roles.includes('authenticated') ||
              routeConfig.roles.includes(req.role)
            )
          ))) {
          next();
        } else {
          throw this.httpErrors.create(403, 'Forbidden');
        }
      } catch (err) {
        next(err);
      }
    };
  }

  async validateDTO(req, res, next) {
    try {
      if (['POST', 'PATCH'].includes(req.method)) {
        const partialValidation = req.method === 'PATCH' ? true : false;
        const validationResult = await this.service.validate(req.body, partialValidation, res.getLocale());
        // If validationResult is a string instead of a boolean,
        // it is a validation error message created by repository layer
        if (typeof validationResult === 'string') throw this.httpErrors.create(400, validationResult);
      }
      next();
    } catch (err) {
      next(err);
    }
  }

  async bulkCreate(req, res, next) {
    try {
      const entitiesDTO = req.body;
      for (const entityDTO of entitiesDTO) {
        // If an id field is provided in body, check if this entity already exists
        if (entityDTO[this.idField]) {
          const entityQuery = { [this.idField]: entityDTO[this.idField] };
          const entity = await this.service.read(entityQuery);
          if (entity) throw this.httpErrors.create(400, this.alreadyExistsMessage(entityDTO[this.idField], res.__mf));
        }
      }
      // If request params object is not empty, this is a nested path and params may be foreign keys
      // They have to be added to DTO to set or overwrite foreign keys values, avoiding misleading resource creations
      if (Object.keys(req.params).length > 0) {
        for (const key in req.params) {
          // Add key to DTO only if it is a foreign key, not a key nested with dot notation
          if (!key.includes('.')) entitiesDTO.forEach(entityDTO => entityDTO[key] = req.params[key]);
        }
      }
      if (this.isMultitenantEnabled &&
        this.service.getTenant() === 'admin' &&
        this.service.hasTenantIdField() &&
        this.isApiSecured && !req.isSuperAdmin) {
        entitiesDTO.forEach(entityDTO => entityDTO.tenantId = req.tenant);
      }
      const newEntities = await this.service.bulkCreate(entitiesDTO);
      const result = this.mapEntities(newEntities, req, res).sort((a, b) => a.id - b.id);
      ['response', `${this.entityName.toLowerCase()} response`, 'bulk create', `${this.entityName.toLowerCase()} bulk create`]
        .forEach(event => this.events.emit(event, result, req, res));
      res.json({
        success: true,
        message: this.successMessage(newEntities
          .map(newEntity => newEntity[this.idField]).sort((a, b) => a - b).join(', '), 'created', res.__mf, true),
        count: result.length,
        result
      });
    } catch (err) {
      ['error response', `${this.entityName.toLowerCase()} error`, 'bulk create error', `${this.entityName.toLowerCase()} bulk create error`]
        .forEach(event => this.events.emit(event, err));
      next(err);
    }
  }

  async bulkValidateDTOs(req, res, next) {
    try {
      if (['POST', 'PATCH'].includes(req.method)) {
        const partialValidation = req.method === 'PATCH' ? true : false;
        for (const [index, DTO] of req.body.entries()) {
          const validationResult = await this.service.validate(DTO, partialValidation, res.getLocale());
          // If validationResult is a string instead of a boolean,
          // it is a validation error message created by repository layer
          if (typeof validationResult === 'string') throw this.httpErrors.create(400, `${res.__(this.entityName)} ${index + 1}: ${validationResult}`);
        }
      }
      next();
    } catch (err) {
      next(err);
    }
  }

}

exports.BaseCrudController = BaseCrudController;
exports.createController = (service, path) => new BaseCrudController(service, path);
