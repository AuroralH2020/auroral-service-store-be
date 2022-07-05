'use strict';

const resourcesService = require('@api/_admin/resources/resources.service');
const layersService = require('@shared/services/layers.service');
const eventsService = require('@shared/services/events.service');
const apiRouter = require('@api/api.router');
const { isMultitenantEnabled, isMultitenantSeparate } = require('@config');

// Create a new controller when a resource is created
eventsService.on('resource create', async function (result, req, res) {
  const DTO = req.body;
  const controller = await layersService.createController(DTO);
  const tenantPath = (isMultitenantEnabled && isMultitenantSeparate) ? `/${DTO.tenantId}` : '';
  apiRouter.use(`${tenantPath}${controller.path}`, controller.router);
});

// Get resources from DB, if any, and re-instantiate controllers at runtime to restore API endpoints
async function createResources() {
  const resources = await resourcesService.list();
  for (const resource of resources) {
    const controller = await layersService.createController(resource);
    const tenantPath = (isMultitenantEnabled && isMultitenantSeparate) ? `/${resource.tenantId}` : '';
    apiRouter.use(`${tenantPath}${controller.path}`, controller.router);
  }
}

module.exports = createResources;
