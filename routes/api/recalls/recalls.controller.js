
var express = require('express');
var router = express.Router();
const httpService = require('@shared/services/http.service');
const { host, port } = require('@config').actionsService;



async function executePromises(promises, data, isArray = false, companies = undefined) {
  let dataPromise;
  let ret = promises.length;
  if (!isArray)
    dataPromise = await Promise.all(promises);
  else
    try {
      dataPromise = [];
      for (let i = 0; i < promises.length; i++) {
        //let data3 = await Promise.all([promises[i]]).catch();
        await promises[i].then(data3 => {
          data3.provider = companies[i];
          dataPromise.push(data3);
        }
        ).catch(error => console.log(error.message));
        console.log('exito');
      }
    } catch {
      console.log('error');
    }

  if (!isArray)
    //dataPromise.forEach((element) => { data.push(element.data.result); });
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
                data2.provider = element.provider;
                data.push(data2);
              });
    });
    companies.splice(0, companies.length);
  }
  promises.splice(0, promises.length);
  return ret;
}

class CallsService {

  constructor() {
    //super(...args);
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
        let companies = [];
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
            companies.push(nodesIds[i][i2].company);
            promises.push(httpService.post(`http://${host}:${port}/api/discovery/remote/semantic/${id}`, body, config));
            if (promises.length >= callsAtSameTime) {
              totalCalls += await executePromises(promises, services, true, companies);
            }
          }
        }
        totalCalls += await executePromises(promises, services, true, companies);
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
        for (let i = 0; i < servicesAll.length; i++)
          servicesAll[i].provider = services[i].provider;
        console.log('Llamadas realizadas en total: ', totalCalls);
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
