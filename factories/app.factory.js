'use strict';

const express = require('express');
const cookieParser = require('cookie-parser');
const fileUpload = require('express-fileupload');
const httpErrors = require('@shared/services/http-errors.service');
const i18n = require('@config/i18n.config');
const swaggerUi = require('swagger-ui-express');
const { isSwaggerUiEnabled } = require('@config');

// Normalize a port into a number, string, or false.
function normalizePort(val) {
  const port = parseInt(val, 10);
  // named pipe
  if (isNaN(port)) return val;
  // port number
  if (port >= 0) return port;
  return false;
}

module.exports = function (appConfig) {

  const app = express();

  // Set to trust HTTP traffic from nginx reverse proxy, as original requests from client use HTTPS.
  // Needed to handle secure cookies (HTTPS only).
  app.set('trust proxy', true);
  // JSON payload parsing middleware
  app.use(express.json());
  // URL-encoded payload parsing middleware
  app.use(express.urlencoded({ extended: false }));
  // Cookie parsing middleware
  app.use(cookieParser());
  // Form-data payload parsing middleware
  app.use(fileUpload(), function (req, res, next) {
    // If there are files attached to the request, add them to the request body
    if (req.files) {
      if (!req.body) req.body = {};
      req.body._files = req.files;
    }
    next();
  }
  );
  // Set response language from request (Accept-Language header) and attach translation methods to req and res objects
  app.use(i18n.init);
  // Serve auto-generated Swagger UI, if enabled
  if (isSwaggerUiEnabled) app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(require('../swagger/swagger.json')));

  // Mount custom middlewares and routers
  const { middlewares, routers } = appConfig;
  if (middlewares) middlewares.forEach(middleware => app.use(middleware));
  if (routers) routers.forEach(routerConfig => app.use(routerConfig.path, routerConfig.router));

  // catch 404 and forward to error handler
  app.use(function (req, res, next) {
    next(httpErrors.create(404));
  });

  // error handler
  app.use(function (err, req, res, next) {
    console.error(err);
    res.status(err.status || (err.response && err.response.status) || 500);
    res.json({
      success: false,
      message: err.message
    });
  });

  // Store port value to be used by the server
  const port = normalizePort(appConfig.port);
  app.set('port', port);

  return app;
};
