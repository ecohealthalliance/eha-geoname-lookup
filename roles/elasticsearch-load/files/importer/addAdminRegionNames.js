var elasticsearch = require('elasticsearch');
console.assert(process.env.ELASTICSEARCH_HOST);
module.exports = function(){
  var esClient = new elasticsearch.Client({
      host: process.env.ELASTICSEARCH_HOST
  });

  var admin1s = {};
  var admin2s = {};
  var countries = {};

  function buildCountryStateMappings(done){
    var sofar = 0;
    esClient.search({
      index: 'geonames',
      scroll: '30s',
      search_type: 'scan',
      fields: ['name', 'admin1Code', 'admin2Code', 'countryCode', 'featureCode']
    }, function getMoreUntilDone(error, response) {
      response.hits.hits.forEach(function (hit) {
        if(hit.fields.featureCode[0] === 'PCLI' || hit.fields.featureCode[0] === 'PCLS'){
          console.log(hit.fields.name[0]);
          countries[hit.fields.countryCode[0]] = hit.fields;
        } else if(hit.fields.featureCode[0] === 'ADM1'){
          //console.log("    " + hit.fields.name[0]);
          admin1s[hit.fields.countryCode[0] + '.' + hit.fields.admin1Code[0]] = hit.fields;
        } else if(hit.fields.featureCode[0] === 'ADM2'){
          admin2s[hit.fields.countryCode[0] + '.' + hit.fields.admin1Code[0] + '.' + hit.fields.admin2Code[0]] = hit.fields;
        }
      });
      sofar += response.hits.hits.length;
    
      if (response.hits.total !== sofar) {
        esClient.scroll({
          scrollId: response._scroll_id,
          scroll: '30s'
        }, getMoreUntilDone);
      } else {
        done();
      }
    });
  }
  function addCountryStateLabels(addLabelsDone){
    var sofar = 0;
    esClient.search({
      index: 'geonames',
      // Set to 30 seconds because we are calling right back
      scroll: '30s',
      search_type: 'scan',
      fields: ['name', 'admin1Code', 'admin2Code', 'countryCode']
    }, function getMoreUntilDone(error, response) {
      var actions = [];
      response.hits.hits.forEach(function (hit) {
        var country = countries[hit.fields.countryCode[0]];
        var admin1 = admin1s[hit.fields.countryCode[0] + '.' + hit.fields.admin1Code[0]];
        var admin2 = admin2s[hit.fields.countryCode[0] + '.' + hit.fields.admin1Code[0] + '.' + hit.fields.admin2Code[0]];
        var doc = {};
        if(country) {
          doc.countryName = country.name[0];
        }
        if(admin1) {
          doc.admin1Name = admin1.name[0];
        }
        if(admin2) {
          doc.admin2Name = admin2.name[0];
        }
        if(Object.keys(doc).length > 0) {
          actions.push({
            update: {
              _id: hit._id
            }
          });
          actions.push({
            doc: doc
          });
        }
      });
      function doBulkUpdate(retries, done) {
        if(actions.length === 0) {
          console.log("No actions for hits:");
          console.log(JSON.stringify(response.hits.hits, 0, 2));
          return done();
        }
        esClient.bulk({
          index: "geonames",
          type: "geoname",
          refresh: false,
          body: actions
        }, function (err, resp) {
          if(err) {
            console.log("Bulk update error:");
            console.log(JSON.stringify(err, 0, 2));
            if(retries > 0) {
              console.log("retrying...");
              doBulkUpdate(retries - 1);
            } else {
              console.log("Bulk update failed for actions:");
              console.log(JSON.stringify(actions, 0, 2));
              done();
            }
          } else {
            if(Math.random() < 0.001) {
              console.log(sofar + " / " + response.hits.total);
            }
            done();
          }
        });
      }
      doBulkUpdate(1, function(){
        sofar += response.hits.hits.length;
        if (response.hits.total !== sofar) {
          esClient.scroll({
            scrollId: response._scroll_id,
            scroll: '30s'
          }, getMoreUntilDone);
        } else {
          addLabelsDone();
        }
      });
    });
  }
  buildCountryStateMappings(function(){
    console.log("Country and state mappings complete.");
    addCountryStateLabels(function(){
      console.log("done!");
    });
  });
};
