var elasticsearch = require('elasticsearch');
console.assert(process.env.ELASTICSEARCH_HOST);
module.exports = function(){
  var esClient = new elasticsearch.Client({
      host: process.env.ELASTICSEARCH_HOST
  });

  var adminDivisions = {};

  function buildCountryStateMappings(done){
    var sofar = 0;
    esClient.search({
      index: 'geonames',
      scroll: '30s',
      size: 50,
      _source: ['name', 'admin1Code', 'admin2Code', 'countryCode', 'featureCode']
    }, function getMoreUntilDone(error, response) {
      if(error || !response.hits.hits) {
        console.log(error);
        console.log(response);
        throw error;
      }
      response.hits.hits.forEach(function (hit) {
        var key;
        var hitDoc = hit._source;
        if(hitDoc.featureCode === 'PCLI' || hitDoc.featureCode === 'PCLS'){
          console.log(hitDoc.name);
          key = hitDoc.countryCode;
        } else if(hitDoc.featureCode === 'ADM1'){
          key = hitDoc.countryCode + '.' + hitDoc.admin1Code;
        } else if(hitDoc.featureCode === 'ADM2'){
          key = hitDoc.countryCode + '.' + hitDoc.admin1Code + '.' + hitDoc.admin2Code;
        } else {
          return;
        }
        if(key in adminDivisions) {
          console.log("    WARNING: Multiple entries for key: " + key);
          console.log(JSON.stringify(adminDivisions[key], 0, 2));
          console.log(JSON.stringify(hitDoc, 0, 2));
        }
        adminDivisions[key] = hitDoc;
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
      scroll: '30s',
      size: 50,
      _source: ['name', 'admin1Code', 'admin2Code', 'countryCode']
    }, function getMoreUntilDone(error, response) {
      if(error) {
        throw error;
      }
      var actions = [];
      response.hits.hits.forEach(function (hit) {
        var hitDoc = hit._source;
        var country = adminDivisions[hitDoc.countryCode];
        var admin1 = adminDivisions[hitDoc.countryCode + '.' + hitDoc.admin1Code];
        var admin2 = adminDivisions[hitDoc.countryCode + '.' + hitDoc.admin1Code + '.' + hitDoc.admin2Code];
        var doc = {};
        if(country) {
          doc.countryName = country.name;
        }
        if(admin1) {
          doc.admin1Name = admin1.name;
        }
        if(admin2) {
          doc.admin2Name = admin2.name;
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
          // console.log("No actions for hits:");
          // console.log(JSON.stringify(response.hits.hits, 0, 2));
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
            if(Math.random() < 0.0001) {
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
