'use strict';

const createRouter = require('@factories/router.factory');
const { isMultitenantEnabled, adminFolder } = require('@config');

// Controllers
// Import tenants controller only if multitenant is enabled
const tenantsController = isMultitenantEnabled ? require(`.${adminFolder}/tenants/tenants.controller`) : undefined;
const usersController = require(`.${adminFolder}/users/users.controller`);
const recallsController = require(`.${adminFolder}/recalls/recalls.controller`);
const resetServices = require('./recalls/reset-services');
const { preloadData } = require('../../config');

const routerConfig = {
  // middlewares: [ fooMiddleware, bazMiddleware ],
  controllers: [
    usersController,
    //recallsController,
  ],
  // routers: [{ path: '/foo', router: fooRouter }],
};

// Register tenants controller in first position, if multitenant enabled
if (isMultitenantEnabled) routerConfig.controllers.unshift(tenantsController);

if(preloadData)
  resetServices.resetServices();
//else
  //resetServices.insertOne();


const router = createRouter(routerConfig);
router.use('',recallsController.router); 

module.exports = router;
