var addAdminRegionNames = require('./addAdminRegionNames');
var Importer = require('geonames-importer');
console.assert(process.env.ELASTICSEARCH_HOST);
var importer = new Importer({
  index: 'geonames',
  filename: '/allCountries.txt',
  elasticsearch: {
    host: process.env.ELASTICSEARCH_HOST
  },
  transformers: [
    function (item) {
      try {
        item.population = parseInt(item.population, 10);
      } catch(e) {
        item.population = 0;
      }
      try {
        item.latitude = parseFloat(item.latitude);
        item.longitude = parseFloat(item.longitude);
      } catch(e) {
        console.log("Error parsing lat/lng");
      }
      if(item.alternateNames && item.alternateNames.length > 0) {
        item.alternateNames = item.alternateNames.split(',');
      } else {
        item.alternateNames = [];
      }
      var rawNames = {};
      rawNames[item.name] = 1;
      item.alternateNames.forEach(function(name){
        rawNames[name] = 1;
      });
      item.rawNames = Object.keys(rawNames);
      return item;
    }
  ]
});
importer
.import()
.then(function () {
  console.log('finished loading geonames');
  addAdminRegionNames();
})
.done();
