'use strict';

var express = require('express');
var router = express.Router();
const httpService = require('@shared/services/http.service');
const { host, port, show_internal } = require('@config').actionsService;
const languages = require('./languages');

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

    if(service.modified)
      service.dateLastUpdate = new Date(service.modified);

    if(service.link ){
      if(service.link.href == undefined)
        service.link = JSON.parse(service.link);
      service.hasURL = service.link.href;
    }

    if (service.serviceName === undefined)
      service.serviceName = [''];
    if (typeof service.serviceName === 'string' || service.serviceName instanceof String)
      service.serviceName = [service.serviceName];
    if(service.title != undefined){
      service.serviceName = [service.title];
    }

    if (service.versionOfService === undefined)
      service.versionOfService = [''];
    if (typeof service.versionOfService === 'string' || service.versionOfService instanceof String)
      service.versionOfService = [service.versionOfService];

    if (service.serviceDescription === undefined)
      service.serviceDescription = [''];
    if (typeof service.serviceDescription === 'string' || service.serviceDescription instanceof String)
      service.serviceDescription = [service.serviceDescription];
    if(service.description != undefined){
      service.serviceDescription = [service.description];
      console.log('descripcion',service);
    }

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

async function executePromisesDoAll(promises, data) {
  let dataPromise = [];
  const ret = promises.length;
  let numSuccess = 0;
  await Promise.allSettled(promises).then(results => {
    results.forEach((result) => {
      let parameter = '';
      if (result.status == 'fulfilled') {
        let index = result.value.config.url.lastIndexOf('/');
        parameter = result.value.config.url.substring(index + 1);
        if (parameter != '')
          result.value.data.message.parameter = parameter;
        dataPromise.push(result.value);
        console.log('Success');
        numSuccess++;
      }
      else if (result.status == 'rejected') {
        console.log('Error in promise: ', result.reason.toString(), ' path:', result.reason.request.path);
      }
    });
  });
  const namesKeysArrays = ['serviceName', 'serviceDescription', 'currentStatus', 'hasDomain',
    'hasSubDomain', 'hasFuncionality', 'hasRequirement', 'serviceFree', 'language', 'versionOfService'];
  const namesKeys = ['provider', 'dateLastUpdate', 'hasURL', 'applicableGeographicalArea',
    'numberOfDownloads','title','description','link','modified'];
  let OIDs = await httpService.get(`http://${host}:${port}/api/registration`);
  dataPromise.forEach((element) => {
    if (element.data != undefined)
      if (element.data.message != undefined)
        if (element.data.message.results != undefined)
          if (element.data.message.results.bindings != undefined) {
            element.data.message.results.bindings.forEach((subElement) => {
              if (subElement.p != undefined && subElement.p.value != undefined && subElement.p.value.includes('https://www.w3.org/2019/wot/td#')) {
                let index = subElement.p.value.indexOf('#');
                if (index >= 0 && subElement.o != undefined && subElement.o.value) {
                  let agid = '';
                  agid = subElement.sub.value.substring('https://oeg.fi.upm.es/wothive/'.length);
                  if (show_internal || !OIDs.data.message.includes(agid)) {
                    let data2 = data.find((a) => a.agid == agid);
                    if (data2 == undefined) {
                      data2 = { agid: agid };
                      data.push(data2);
                    }
                    let key = subElement.p.value.substring(index + 1);
                    if (namesKeysArrays.includes(key)) {
                      if (data2[key] == undefined)
                        data2[key] = [subElement.o.value];
                      else
                        data2[key].push(subElement.o.value);
                    }
                    else if (namesKeys.includes(key)) {
                      data2[key] = subElement.o.value;
                    }
                  }
                }
              }
            });
          }
  });
  promises.splice(0, promises.length);
  if (numSuccess > 0)
    return ret;
  else return 0;
}

let myCache = undefined;

async function servicesDoAll(allData, servicesAll, callsAtSameTime) {
  // do all the work
  let communitiesIds = [], promises = [], totalCalls = 0;
  communitiesIds = await httpService.get(`http://${host}:${port}/api/collaboration/communities`);
  communitiesIds.data.message.forEach(community => {
    allData.push(community);
  });
  console.log('Comunities: ', allData);
  communitiesIds = communitiesIds.data.message;
  for (let i = 0; i < communitiesIds.length; i++) {
    let id = communitiesIds[i].commId;
    const body = 'PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> ' +
      'PREFIX wot: <https://www.w3.org/2019/wot/td#> ' +
      'SELECT distinct ?p ?o ?sub WHERE {  ' +
      '?sub rdf:type wot:Service . ' +
      '?sub ?p ?o . } '; // the body may change
    const config = { headers: { 'Content-Type': 'text/plain' } };
    promises.push(httpService.post(`http://${host}:${port}/api/discovery/remote/semantic/community/${id}`, body, config));
    if (promises.length >= callsAtSameTime) {
      totalCalls += await executePromisesDoAll(promises, servicesAll);
    }
  }
  totalCalls += await executePromisesDoAll(promises, servicesAll);
  arraysToArrays(servicesAll); // parse data
  parseLanguages(servicesAll); // parse data language
  if (totalCalls > 0) {
    if (myCache == undefined) {   
      console.log('Cache loaded');
    }
    myCache = [ ...servicesAll ];
  }
  //console.log('servicios en la cache',myCache);
  return totalCalls;
}

// load data to cache, at start and at intervals
servicesDoAll([], [], 100); // read the services to cache at start
setInterval(async function () {
  await servicesDoAll([], [], 100);
  console.log('Services reloaded to cache, number of services: ',myCache.length);
}, 600000);


class CallsService {

  constructor() {
    this.http = httpService;
    this.url = `http://${host}:${port}`;
    this.router = router;
    this.callsAtSameTime = 100;

    this.router.get('/services', async function (req, res) {
      try {
        let allData = [], servicesAll = [];
        const callsAtSameTime = 100;
        let totalCalls = 1;
        const beginTime = Date.now();
        servicesAll = [];
        allData = [];

        if (req.query.cache != 'true') {
          totalCalls += await servicesDoAll(allData, servicesAll, callsAtSameTime);
          if(totalCalls == 1) // if all calls fail return cache
            servicesAll = myCache; 
          console.log('services of call');
        }
        else {
          servicesAll = myCache;
          console.log('services of cache');
        }
        console.log(req.params, req.query);
        console.log('Number of calls: ', totalCalls);
        console.log('Services send: ', servicesAll);
        console.log('Time: ', (Date.now() - beginTime) / 1000, ' seconds');

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
