'use strict';

const setBoolean = (value, defaultValue = false) => {
  return ['true', 'false'].includes(value) ? JSON.parse(value) : defaultValue;
};

const config = {
  expressPort: process.env.EXPRESS_PORT,
  adminFolder: process.env.ADMIN_FOLDER || '',
  tenantsFolder: process.env.TENANTS_FOLDER || '',
  listLimit: process.env.LIST_LIMIT || undefined,
  secret: process.env.SECRET || '',
  isApiSecured: setBoolean(process.env.API_SECURED, false),
  routesWhitelist: process.env.ROUTES_WHITELIST != undefined ? process.env.ROUTES_WHITELIST.split(',') : [],
  preloadData: setBoolean(process.env.PRELOAD_DATA, false),
  autoconvertExcel: setBoolean(process.env.AUTOCONVERT_EXCEL, false),
  isSwaggerUiEnabled: setBoolean(process.env.SWAGGERUI_ENABLED, false),
  isMultitenantEnabled: setBoolean(process.env.MULTITENANT_ENABLED, false),
  isMultitenantSeparate: setBoolean(process.env.MULTITENANT_SEPARATE, false),
  isRuntimeResourcesEnabled: setBoolean(process.env.RUNTIME_RESOURCES_ENABLED, false),
  isSocketIoEnabled: setBoolean(process.env.SOCKETIO_ENABLED, false),
  sequelize: {
    dialect: process.env.SEQUELIZE_DIALECT || 'postgres',
    db: process.env.SEQUELIZE_DB || '',
    user: process.env.SEQUELIZE_USER || '',
    pass: process.env.SEQUELIZE_PASS || '',
    host: process.env.SEQUELIZE_HOST || '',
    port: process.env.SEQUELIZE_PORT || '',
    schema: process.env.SEQUELIZE_SCHEMA || 'elliot',
    alter: setBoolean(process.env.SEQUELIZE_ALTER, false),
    force: setBoolean(process.env.SEQUELIZE_FORCE, false),
    dropSchema: setBoolean(process.env.SEQUELIZE_DROP_SCHEMA, false),
    logging: setBoolean(process.env.SEQUELIZE_LOGGING, true),
    underscored: setBoolean(process.env.SEQUELIZE_UNDERSCORED, false),
  },
  i18n: {
    locales: process.env.LOCALES.split(','),
    defaultLocale: process.env.DEFAULT_LOCALE
  },
  actionsService: {
    host: process.env.ACTIONS_SERVICE_HOST,
    port: process.env.ACTIONS_SERVICE_PORT
  }
};

console.log('Configuration loaded:', config);

module.exports = config;
