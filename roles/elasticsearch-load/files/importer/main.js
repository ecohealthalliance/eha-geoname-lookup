var addAdminRegionNames = require('./addAdminRegionNames');
var Importer = require('geonames-importer');
var Downloader = require('geonames-importer/downloader');
//var process = require('process');
console.assert(process.env.ELASTICSEARCH_HOST);
var importer = new Importer({
  index: 'geonames',
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
      if(item.alternateNames && item.alternateNames.length > 0) {
        item.alternateNames = item.alternateNames.split(',');
      } else {
        item.alternatenames = [];
      }
      return item;
    }
  ]
});
var downloader = new Downloader({
  tmp: '/tmp'
});
importer
.import(downloader.country())
.then(function () {
  console.log('finished loading geonames');
  addAdminRegionNames();
})
.done();

