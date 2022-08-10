'use strict';

var express = require('express');
var router = express.Router();
const httpService = require('@shared/services/http.service');
const { host, port } = require('@config').actionsService;
const languages = require('./languages');



async function executePromises(promises, data, isArray = false) {
  let dataPromise;
  let ret = promises.length;
  if (!isArray)
    dataPromise = await Promise.all(promises);
  else {
    dataPromise = [];
    await Promise.allSettled(promises)
      .then(results => {
        results.forEach((result) => {
          if (result.status == 'fulfilled') {
            dataPromise.push(result.value);
            console.log('Success');
          }
          else if (result.status == 'rejected') {
            console.log('Error in promise: ', result.reason.toString());
          }
        });
      });
  }

  if (!isArray)
    dataPromise.forEach((element) => { data.push(element.data.message); });
  else {
    dataPromise.forEach((element) => {
      if (element.data != undefined)
        if (element.data.message != undefined)
          if (element.data.message.results != undefined)
            if (element.data.message.results.bindings != undefined)
              element.data.message.results.bindings.forEach((subElement) => {
                let data2 = {};
                data2.agid = subElement.g.value.toString().substring(6);
                data.push(data2);
              });
    });
  }
  promises.splice(0, promises.length);
  return ret;
}

function parseLanguages(services) {
  services.map(service => {
    service.language = service.language.map(lan => {
      const parsedLanguage = languages.getRArray().filter(language => language.Id == lan);
      if (parsedLanguage != undefined && parsedLanguage.length > 0)
        lan = parsedLanguage[0].Print_Name;
      return lan;
    }
    );
  });
}

function arraysToArrays(services) {
  services.forEach(service => {
    if (service.serviceName === undefined)
      service.serviceName = [''];
    if (typeof service.serviceName === 'string' || service.serviceName instanceof String)
      service.serviceName = [service.serviceName];

    if (service.serviceDescription === undefined)
      service.serviceDescription = [''];
    if (typeof service.serviceDescription === 'string' || service.serviceDescription instanceof String)
      service.serviceDescription = [service.serviceDescription];

    if (service.currentStatus === undefined)
      service.currentStatus = [''];
    if (typeof service.currentStatus === 'string' || service.currentStatus instanceof String)
      service.currentStatus = [service.currentStatus];

    if (service.hasDomain === undefined)
      service.hasDomain = [''];
    if (typeof service.hasDomain === 'string' || service.hasDomain instanceof String)
      service.hasDomain = [service.hasDomain];

    if (service.hasSubDomain === undefined)
      service.hasSubDomain = [''];
    if (typeof service.hasSubDomain === 'string' || service.hasSubDomain instanceof String)
      service.hasSubDomain = [service.hasSubDomain];

    if (service.hasFuncionality === undefined)
      service.hasFuncionality = [''];
    if (typeof service.hasFuncionality === 'string' || service.hasFuncionality instanceof String)
      service.hasFuncionality = [service.hasFuncionality];

    if (service.hasRequirement === undefined)
      service.hasRequirement = [''];
    if (typeof service.hasRequirement === 'string' || service.hasRequirement instanceof String)
      service.hasRequirement = [service.hasRequirement];

    if (service.serviceFree === undefined)
      service.serviceFree = [false];
    if (typeof service.serviceFree === 'boolean' || service.serviceFree instanceof Boolean)
      service.serviceFree = [service.serviceFree];

    if (service.language === undefined)
      service.language = [''];
    if (typeof service.language === 'string' || service.language instanceof String)
      service.language = [service.language];

  });
}

class CallsService {

  constructor() {
    this.http = httpService;
    this.url = `http://${host}:${port}`;
    this.router = router;
    this.router.use(function timeLog(req, res, next) {
      console.log('Time: ', Date.now());
      next();
    });

    this.router.get('/services', async function (req, res) {
      try {
        let services = [], communitiesIds = [], nodesIds = [], promises = [];
        const callsAtSameTime = 100;
        let totalCalls = 1;
        communitiesIds = await httpService.get(`http://${host}:${port}/api/collaboration/communities`);
        //communitiesIds = communitiesIds.data.result; // this may vary
        communitiesIds = communitiesIds.data.message;
        for (let i = 0; i < communitiesIds.length; i++) {
          let id = communitiesIds[i].commId;
          promises.push(httpService.get(`http://${host}:${port}/api/discovery/nodes/community/${id}`));
          if (promises.length >= callsAtSameTime) {
            totalCalls += await executePromises(promises, nodesIds);
          }
        }
        totalCalls += await executePromises(promises, nodesIds);
        console.log('nodes: ', nodesIds);
        for (let i = 0; i < nodesIds.length; i++) {
          for (let i2 = 0; i2 < nodesIds[i].length; i2++) {
            let body = 'PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>' +
              ' PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> ' +
              ' SELECT * WHERE { ' +
              ' GRAPH $g { ' +
              ' ?sub <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://www.w3.org/2019/wot/td#Service> . ' +
              '}} '; // the body may change
            const config = { headers: { 'Content-Type': 'text/plain' } };
            let id = nodesIds[i][i2].agid;
            promises.push(httpService.post(`http://${host}:${port}/api/discovery/remote/semantic/${id}`, body, config));
            if (promises.length >= callsAtSameTime) {
              totalCalls += await executePromises(promises, services, true);
            }
          }
        }
        totalCalls += await executePromises(promises, services, true);
        services = services.filter((item, index, self) => {
          return self.indexOf(self.find(e => e.agid == item.agid)) == index;
        });
        let servicesAll = [];
        for (let i = 0; i < services.length; i++) {
          let id = services[i].agid;
          promises.push(httpService.get(`http://${host}:${port}/api/discovery/remote/td/${id}/${id}`));
          if (promises.length >= callsAtSameTime) {
            totalCalls += await executePromises(promises, servicesAll);
          }
        }
        totalCalls += await executePromises(promises, servicesAll);
        arraysToArrays(servicesAll);
        parseLanguages(servicesAll);
        for (let i = 0; i < servicesAll.length; i++) {
//          console.log(servicesAll[i]);
        }
        console.log('Llamadas realizadas en total: ', totalCalls);
        //console.log('Enviado al front en ultimo servicio: ', servicesAll[servicesAll.length - 1]);
        res.send({ result: servicesAll });
      }
      catch (e) {
        console.log(e);
        res.status(500).send({ error: 'Something failed!' });
      }
    });
  }



}

module.exports = new CallsService();
