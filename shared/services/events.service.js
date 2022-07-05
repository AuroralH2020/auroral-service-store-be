'use strict';

const EventEmitter = require('events');

const eventsService = new EventEmitter();

// Allow more listeners to be used once for repositories on start up
// This removes console warning
// eventsService.setMaxListeners(20);

module.exports = eventsService;
