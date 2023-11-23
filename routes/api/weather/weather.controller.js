'use strict';

const express = require('express');
const router = express.Router();
const httpService = require('@shared/services/http.service');
const { host, port } = require('@config').actionsService;

class WeatherController {
  constructor() {
    this.http = httpService;
    this.url = `http://${host}:${port}`;
    this.router = router;

    this.router.get('/weather/:latitude/:longitude', async function (req, res) {
      const latitude = req.params.latitude;
      const longitude = req.params.longitude;

      try {
        const result = await httpService.get(
          `http://${host}:${port}/api/properties/13ebc723-c3b9-4e43-9e7e-f1b877446bf6/f17f9f7d-f753-4d7a-aa2c-8d307f944746/weather?latitude=${latitude}&longitude=${longitude}`
        );
        res.send(result.data);
      } catch (e) {
        console.log(e);
        res.status(500).send({ error: 'Service not available' });
      }
    });
  }
}

module.exports = new WeatherController();
