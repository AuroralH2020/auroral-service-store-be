'use strict';

const httpService = require('@shared/services/http.service');
const { host, port } = require('@config').actionsService;


class ResetServices {

  async deleteServices() {
    let OIDs = await httpService.get(this.url + '/api/registration');
    if (OIDs.status == 200) {
      if (OIDs.data.message != undefined && OIDs.data.message.length > 0) {
        console.log('Deleting services of the node: ', OIDs.data.message);
        let result = await httpService.post(this.url + '/api/registration/remove', { oids: OIDs.data.message });
        if (result.status == 200)
          console.log('Services of the node deleted');
      }
      else if (OIDs.data.message != undefined && OIDs.data.message.length == 0) {
        console.log('No services for delete');
      }
    }
    else {
      console.log('Fail on load the ids of the services of the node');
    }
  }

  randomService(i) {
    let counter = 0;
    let salt = (Math.random() + 1).toString(36).substring(9).toString();
    for (let i = 0; i < (Math.random() * 20 + 1); i++)
      salt += (Math.random() + 1).toString(36).substring(9).toString();
    this.item.td.adapterId = this.adapterId + i.toString() + '--' + salt;
    this.item.td.title = this.title + i.toString() + salt;
    this.item.td.name = this.name + i.toString() + salt;

    this.item.td.serviceName = this.names[Math.floor(Math.random() * this.names.length)];

    this.item.td.serviceDescription = [];
    counter = Math.floor(Math.random() * 3);
    if (counter == 0)
      counter = 1;
    for (i = 0; i < counter; i++)
      this.item.td.serviceDescription.push(this.descriptions[Math.floor(Math.random() * this.descriptions.length)]);
    this.item.td.provider = this.providers[Math.floor(Math.random() * this.providers.length)];



    this.item.td.currentStatus = [];
    counter = Math.floor(Math.random() * 3);
    if (counter == 0)
      counter = 1;
    for (i = 0; i < counter; i++)
      this.item.td.currentStatus.push(this.currentStatus[Math.floor(Math.random() * this.currentStatus.length)]);

    this.item.td.dateLastUpdate = this.dates[Math.floor(Math.random() * this.dates.length)];

    this.item.td.hasDomain = [];
    this.item.td.hasSubDomain = [];
    counter = Math.floor(Math.random() * 3);
    const domainId = Math.floor(Math.random() * this.domains.length);
    if (counter == 0)
      counter = 1;
    for (i = 0; i < counter; i++)
      this.item.td.hasDomain.push(this.domains[domainId].domain);
    counter = Math.floor(Math.random() * 3);
    if (counter == 0)
      counter = 2;
    for (i = 0; i < counter; i++)
      this.item.td.hasSubDomain.push(this.domains[domainId].subdomain[Math.floor(Math.random() * this.domains[domainId].subdomain.length)]);

    this.item.td.hasFuncionality = [];
    counter = Math.floor(Math.random() * 3);
    if (counter == 0)
      counter = 1;
    for (i = 0; i < counter; i++)
      this.item.td.hasFuncionality.push(this.funcionalities[Math.floor(Math.random() * this.funcionalities.length)]);

    this.item.td.hasRequirement = [];
    counter = Math.floor(Math.random() * 3);
    if (counter == 0)
      counter = 1;
    for (i = 0; i < counter; i++)
      this.item.td.hasRequirement.push(this.hasRequirement[Math.floor(Math.random() * this.hasRequirement.length)]);

    this.item.td.serviceFree = [];
    counter = Math.floor(Math.random() * 3);
    if (counter == 0)
      counter = 1;
    for (i = 0; i < counter; i++) {
      const bool = [true, false];
      this.item.td.serviceFree.push(bool[Math.floor(Math.random() * bool.length)]);
    }

    this.item.td.hasURL = this.URLs[Math.floor(Math.random() * this.URLs.length)];

    this.item.td.language = [];
    counter = Math.floor(Math.random() * 3);
    if (counter == 0)
      counter = 1;
    for (i = 0; i < counter; i++)
      this.item.td.language.push(this.languages[Math.floor(Math.random() * this.languages.length)]);

    this.item.td.applicableGeographicalArea = this.applicableGeographicalArea[Math.floor(Math.random() * this.applicableGeographicalArea.length)];

    this.item.td.numberOfDownloads = Math.floor(Math.random() * 1000);

    this.item.td.versionOfService = this.versionOfService[Math.floor(Math.random() * this.versionOfService.length)];

    console.log(this.item.td.serviceName, this.item.td.adapterId);
    return this.item;
  }

  async insertOne() {
    let OIDs = await httpService.get(`http://${host}:${port}/api/registration`);
    if (OIDs.data == undefined || OIDs.data.message.length == 0)
      this.insertServices(1);
  }

  async insertOneRecursive(self, i, numServicesToInsert) {
    setTimeout((function (self, i, numServicesToInsert) {
      return function () {
        try {
          self.randomService(i);
          httpService.post(self.url + '/api/registration', self.item);
          console.log('Service created', i);
          if (i < (numServicesToInsert - 1)) {
            i++;
            self.insertOneRecursive(self, i, numServicesToInsert);
          }
        }
        catch (err) {
          /*if (err.response != undefined && err.response.data != undefined && err.response.data.message != undefined)
            console.log('Fail on reset services: ', err.response.data.message, self.item);
          else*/
          console.log('Fail on reset services: ', err);
        }
      };
    })(this, i, numServicesToInsert), 10000);
  }

  async insertServices(numServicesToInsert) {
    this.insertOneRecursive(this, 0, numServicesToInsert);
  }

  async resetServices(numServicesToInsert = 12) {
    console.log('Reset the services of our node');
    this.http = httpService;
    this.url = `http://${host}:${port}`;
    try {
      await this.deleteServices();
      await this.insertServices(numServicesToInsert);
    }
    catch (err) {
      if (err.response != undefined && err.response.data != undefined)
        console.log('Fail on reset services: ', err.response.data.message);
      else
        console.log('Fail on reset services: ', err);
    }
  }

  constructor() {
    this.item = {
      td: {
        '@context': 'https://www.w3.org/2019/wot/td/v1',
        title: 'Monitor Service',
        '@type': 'Service',
        securityDefinitions: {
          nosec_sc: {
            scheme: 'nosec'
          }
        },
        security: 'nosec_sc',
        properties: {
          status: {
            type: 'string',
            forms: [{ href: 'https://mylamp.example.com/status' }]
          }
        },
        actions: {},
        events: {},
        adapterId: 'node-red-consume',
        //'oid': 'b0c2d27a-e3a1-45e2-89f2-901d3d78g26bc',
        serviceName: ['Service6', 'Tourism monitor'],
        serviceDescription: ['Count persons', 'Las personas recibidas en una hora'],
        provider: 'Bosonit',
        currentStatus: ['Active', 'Avaliable'],
        dateLastUpdate: new Date().toUTCString(),//'2021-11-09T18:25:43.511Z',
        hasDomain: ['Mobility'],
        hasSubDomain: ['Fly'],
        hasFuncionality: ['Only read', 'View in a lot of places'],
        hasRequirement: ['The date to read the persons'],
        serviceFree: [true, false],
        hasURL: 'http://rur.tourism.com/itisveryimportant/birds',
        language: ['spa', 'eng'],
        applicableGeographicalArea: 'Spain',
        numberOfDownloads: 129,
        versionOfService: '1.4',
        name: 'nameOfService'
      },
      //avatar': 'nostrud sunt'
    };
    this.adapterId = this.item.td.adapterId;
    this.title = this.item.td.title;
    this.name = this.item.td.name;


    this.names = [['Monitor service1', 'Counter of persons'],
    ['Monitor service2'],
    ['Service counter of birds'],
    ['Counter of rain']
    ];
    this.descriptions = ['The end-users, tourists see relevant and current information about the ' +
      'regions touristic offers, attractions (POIs), events, products and services.',
      'These will be supported also by in-app push notifications to ensure the up-to-date information.',
    'Existing local service providers can also integrate their services, offers, and relevant touristic' +
    ' information into the AURORAL pilot platform to maximize the efficiency of the touristic ' +
    'information and make them all available on one oHA digital platform.',
      'The user will have access also to information about the mobility services in the region, destination.',
      'This way, tourists can plan their holidays and their programme and have all essential touristic information digitally at their disposal.',
      'The tourists can also direct contact the local providers or find in Web-App oHA all information needed.',
    ];
    this.providers = ['LuxActive', 'Elliot', 'Bosonit', 'bAvenir'];
    this.currentStatus = ['Active', 'Avaliable', 'Deprecated', 'Stable', 'Development'];
    const date = new Date();
    const day = date.getDate();
    let date1 = new Date();
    let date2 = new Date();
    let date3 = new Date();
    let date4 = new Date();
    /*date1.setDate(this.returnPositive(day - 1));
    date2.setDate(this.returnPositive(day - 2));
    date3.setDate(this.returnPositive(day - 3));
    date4.setDate(this.returnPositive(day - 4));*/
    date1.setDate(date1.getDate() - 1);
    date2.setDate(date2.getDate() - 2);
    date3.setDate(date3.getDate() - 3);
    date4.setDate(date4.getDate() - 4);
    this.dates = [date.toUTCString(), date1.toUTCString(), date2.toUTCString(), date3.toUTCString(), date4.toUTCString(),];
    this.domains = [{ domain: 'Tourism', subdomain: ['Movility', 'Beach', 'Mountain'] },
    { domain: 'Energy', subdomain: ['Solar', 'Air', 'Ocean'] },
    { domain: 'Farm', subdomain: ['Cow', 'Bird', 'Cat'] },
    { domain: 'Health', subdomain: ['Hospital', 'Temperature', 'Pharmacy'] }];
    this.funcionalities = ['Data analysis', 'Maps/Geolocation', 'Decision support',
      'Information about local touristic services, products, offers, weather information, navigation, real-time available ' +
      'events, news, information about mobility services, touristic experiences like tours, POIs location-based, information' +
      ' about destination and region'];
    this.hasRequirement = ['Domain name', 'Data sources and APIs/widgets to existing systems',
      'Provide oHA instance with relevant content (pictures, flyers, videos, information about services, etc.)',
      'Logins to oHA Base, managing tool of the Webb-App oHA',
      'Creation of the personalized design with oHA Editor',
      'Editing of activities, attractions, bookings, or products and essential content to oHA Web-App via oHA Base',
      'Marketing and dissemination activities to oHA end-users, present oHA in region and pilot'];
    this.URLs = ['http://www.spain.com/spain/service2',
      'http://www.italy.com/italy/service2',
      'http://www.france.com/france/service2',
      'http://www.germany.com/germany/service2',
    ];
    this.applicableGeographicalArea = ['Spain', 'France', 'Italy', 'German', 'Portugal'];
    this.languages = ['spa', 'eng', 'fra', 'deu', 'ita'];
    this.versionOfService = ['1.0', '1.1', '1.2', '2.0', '2.1'];
  }

  returnPositive(num) {
    if (num > 0)
      return num;
    return 1;
  }
}

module.exports = new ResetServices();

