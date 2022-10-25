'use strict';

var express = require('express');
var router = express.Router();
const httpService = require('@shared/services/http.service');
const { host, port, show_internal } = require('@config').actionsService;
const languages = require('./languages');


/*
async function executePromises(promises, data, isIdService = false, isDataService = false) {
  let dataPromise = [];
  let ret = promises.length;
  await Promise.allSettled(promises)
    .then(results => {
      results.forEach((result) => {
        let parameter = '';
        if (result.status == 'fulfilled') {
          let index = result.value.config.url.lastIndexOf('/');
          parameter = result.value.config.url.substring(index + 1);
          if (parameter != '')
            result.value.data.message.parameter = parameter;
          dataPromise.push(result.value);
          console.log('Success');
        }
        else if (result.status == 'rejected') {
          console.log('Error in promise: ', result.reason.toString(), ' path:', result.reason.request.path);
        }
      });
    });
  if (!isIdService && !isDataService)
    dataPromise.forEach((element) => { data.push(element.data.message); });
  else if (!isDataService) {
    dataPromise.forEach((element) => {
      if (element.data != undefined)
        if (element.data.message != undefined && element.data.message.parameter != undefined)
          if (element.data.message.results != undefined)
            if (element.data.message.results.bindings != undefined)
              element.data.message.results.bindings.forEach((subElement) => {
                if (subElement.g != undefined && subElement.g.value != undefined && subElement.g.value.length > 7) {
                  let data2 = {};
                  data2.agid = subElement.g.value.toString().substring(6);
                  data2.parameter = element.data.message.parameter;
                  data.push(data2);
                }
              });
    });
  }
  else if (isDataService) {
    const namesKeysArrays = ['serviceName', 'serviceDescription', 'currentStatus', 'hasDomain',
      'hasSubDomain', 'hasFuncionality', 'hasRequirement', 'serviceFree', 'language', 'versionOfService'];
    const namesKeys = ['provider', 'dateLastUpdate', 'hasURL', 'applicableGeographicalArea',
      'numberOfDownloads'];
    dataPromise.forEach((element) => {
      if (element.data != undefined)
        if (element.data.message != undefined)
          if (element.data.message.results != undefined)
            if (element.data.message.results.bindings != undefined) {
              let data2 = {};
              element.data.message.results.bindings.forEach((subElement) => {
                if (subElement.pred != undefined && subElement.pred.value != undefined) {
                  let index = subElement.pred.value.indexOf('#');
                  if (index >= 0 && subElement.obj != undefined && subElement.obj.value) {
                    let key = subElement.pred.value.substring(index + 1);
                    if (namesKeysArrays.includes(key)) {
                      if (data2[key] == undefined)
                        data2[key] = [subElement.obj.value];
                      else
                        data2[key].push(subElement.obj.value);
                    }
                    else if (namesKeys.includes(key)) {
                      data2[key] = subElement.obj.value;
                    }
                  }
                }
              });
              if (data != {})
                data.push(data2);
            }
    });
  }
  promises.splice(0, promises.length);
  return ret;
}



function insert_nodes_data(allData, nodesIds) {
  allData.forEach(data => {
    data.nodes = [];
    let find = false;
    for (let i = 0; i < nodesIds.length && !find; i++) {
      if (data.commId == nodesIds[i].parameter) {
        delete nodesIds[i].parameter;
        find = true;
        data.nodes = nodesIds[i];
      }
    }
  });
}

function insert_services_data(allData, services) {
  allData.forEach(data => {
    for (let iData = 0; iData < data.nodes.length; iData++) {
      data.nodes[iData].services = [];
      for (let iServices = 0; iServices < services.length; iServices++) {
        if (services[iServices].parameter == data.nodes[iData].agid) {
          data.nodes[iData].services.push(services[iServices]);
        }
      }
    }
  });
}

function insert_all_in_services_data(allData, allServices) {
  allServices.forEach(service => {
    let find = false;
    for (let i = 0; i < allData.length && !find; i++) {
      for (let i2 = 0; i2 < allData[i].nodes.length && !find; i2++) {
        for (let i3 = 0; i3 < allData[i].nodes[i2].services.length && !find; i3++) {
          if (allData[i].nodes[i2].services[i3].agid == service.id) {
            find = true;
            service.community = { description: allData[i].description, name: allData[i].name, commId: allData[i].commId };
            service.node = { company: allData[i].nodes[i2].company, cid: allData[i].nodes[i2].cid, agid: allData[i].nodes[i2].agid };
          }
        }
      }
    }
  });
}

async function insert_communities_nodes(allData, nodesIds, callsAtSameTime) {
  let communitiesIds = [], promises = [], totalCalls = 0;
  communitiesIds = await httpService.get(`http://${host}:${port}/api/collaboration/communities`);
  communitiesIds.data.message.forEach(community => {
    allData.push(community);
  });
  //allData = communitiesIds.data.message;
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
  insert_nodes_data(allData, nodesIds);
  console.log('nodes', allData);
  console.log('List of nodes:');
  allData.forEach(data => {
    data.nodes.forEach(node => {
      console.log(node);
    });
  });
  return totalCalls;
}

async function insert_services_ids(nodesIds, allData, services, callsAtSameTime) {
  let totalCalls = 0, promises = [];
  for (let i = 0; i < nodesIds.length; i++) {
    for (let i2 = 0; i2 < nodesIds[i].length; i2++) {
      const body = 'PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>' +
        ' PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> ' +
        ' SELECT * WHERE { ' +
        ' GRAPH ?g { ' +
        ' ?sub <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://www.w3.org/2019/wot/td#Service> . ' +
        '}} '; // the body may change
      const config = { headers: { 'Content-Type': 'text/plain' }, timeout: 3000 };
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
  insert_services_data(allData, services);
  return totalCalls;
}

async function insert_services_sparql(servicesAll, services, callsAtSameTime) {
  let promises = [], totalCalls = 0;
  let OIDs = await httpService.get(`http://${host}:${port}/api/registration`);
  let idMyNode = ''; // necesitamos una forma mejor de sacar la id del nodo
  for (let i = 0; i < services.length && idMyNode == ''; i++) {
    if (OIDs.data.message.includes(services[i].agid)) {
      idMyNode = services[i].parameter;
    }
  }
  for (let i = 0; i < services.length; i++) {
    let id = services[i].agid;
    const body = 'PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>' +
      'PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> ' +
      'SELECT * WHERE { GRAPH ?g { ?sub ?pred ?obj . ' +
      '} FILTER ( ?g IN (<graph:' + id + '> ))}'; // the body may change
    const config = { headers: { 'Content-Type': 'text/plain' } };
    if (show_internal || services[i].parameter !== idMyNode) {
      id = services[i].parameter;
      promises.push(httpService.post(`http://${host}:${port}/api/discovery/remote/semantic/${id}`, body, config));
    }
    if (promises.length >= callsAtSameTime) {
      totalCalls += await executePromises(promises, servicesAll, false, true);
    }
  }
  totalCalls += await executePromises(promises, servicesAll, false, true);
  return totalCalls;
}
*/

/*
async function insert_services(servicesAll, services, callsAtSameTime) {
  let promises = [], totalCalls = 0;
  for (let i = 0; i < services.length; i++) {
    let id = services[i].agid;
    let id2 = '87c00849-2452-48ec-aa98-c3a62e3556d8';
    //id2 = 'ad813ae2-3c04-4639-9cdd-34cb1557b9b9';
    promises.push(httpService.get(`http://${host}:${port}/api/discovery/remote/td/${id}/${id2}`));
    if (promises.length >= callsAtSameTime) {
      totalCalls += await executePromises(promises, servicesAll);
    }
  }
  totalCalls += await executePromises(promises, servicesAll);
  return totalCalls;
}
*/

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

    if (service.versionOfService === undefined)
      service.versionOfService = [''];
    if (typeof service.versionOfService === 'string' || service.versionOfService instanceof String)
      service.versionOfService = [service.versionOfService];

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

async function executePromisesDoAll(promises, data) {
  let dataPromise = [];
  const ret = promises.length;
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
      }
      else if (result.status == 'rejected') {
        console.log('Error in promise: ', result.reason.toString(), ' path:', result.reason.request.path);
      }
    });
  });
  const namesKeysArrays = ['serviceName', 'serviceDescription', 'currentStatus', 'hasDomain',
    'hasSubDomain', 'hasFuncionality', 'hasRequirement', 'serviceFree', 'language', 'versionOfService'];
  const namesKeys = ['provider', 'dateLastUpdate', 'hasURL', 'applicableGeographicalArea',
    'numberOfDownloads'];
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
  return ret;
}

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
  //insert_nodes_data(allData, servicesAll);
  return totalCalls;


}




class CallsService {

  constructor() {
    this.http = httpService;
    this.url = `http://${host}:${port}`;
    this.router = router;
    this.callsAtSameTime = 100;
    /*this.router.use(function timeLog(req, res, next) {
      console.log('Time: ', Date.now());
      next();
    });*/

    this.router.get('/services', async function (req, res) {
      try {
        let allData = [], servicesAll = [];
        const callsAtSameTime = 100;
        let totalCalls = 1;
        const beginTime = Date.now();
        let services = [], nodesIds = [];                
        /*totalCalls += await insert_communities_nodes(allData, nodesIds, callsAtSameTime);
        totalCalls += await insert_services_ids(nodesIds, allData, services, callsAtSameTime);
        totalCalls += await insert_services_sparql(servicesAll, services, callsAtSameTime);
        arraysToArrays(servicesAll); // parse data
        parseLanguages(servicesAll); // parse data language
        insert_all_in_services_data(allData, servicesAll); // parse data
        for (let i = 0; i < 1 && i < servicesAll.length; i++) {
          console.log('servicio', servicesAll[i]);
        }
        allData.forEach(community => {
          console.log(community);
          let counter = 0;
          community.nodes.forEach(node => {
            if (counter < 10) {
              console.log('Node: ', node);
              counter++;
            }
          });
        });
        console.log('Llamadas realizadas en total: ', totalCalls);
        */
        servicesAll = [];
        allData = [];
        totalCalls += await servicesDoAll(allData, servicesAll, callsAtSameTime);
        arraysToArrays(servicesAll); // parse data
        parseLanguages(servicesAll); // parse data language
        console.log('Number of calls: ', totalCalls);
        console.log('Services send: ', servicesAll);
        console.log('Time: ', (Date.now() - beginTime)/1000, ' seconds' );
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
