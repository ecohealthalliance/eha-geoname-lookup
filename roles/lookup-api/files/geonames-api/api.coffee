express = require("express")
bodyParser = require("body-parser")
elasticsearch = require('elasticsearch')
path = require('path')

console.assert(process.env.ELASTICSEARCH_HOST)

client = new elasticsearch.Client(
  host: process.env.ELASTICSEARCH_HOST
  log: 'trace'
)

app = express()
app.use bodyParser.json()
app.use bodyParser.urlencoded(extended: true)
app.use express.static(path.join(__dirname, 'public'))

###
@apiName Geoname Lookup
@apiGroup Geonames
@api {get} /lookup Search for Geonames

@apiParam {String} q A free-text place name
@apiParam {Number} maxRows=10 The maximum number of results to return
@apiParam {Boolean} explain=false Return debug information about how the results were scored
@apiParam {String[]} fields The geoname fields to return
###
app.all '/api/lookup', (req, res, next)->
  res.header "Access-Control-Allow-Origin", "*"
  q = req.query.q or req.body.q
  explain = req.query.explain or req.body.explain
  maxRows = req.query.maxRows or req.body.maxRows
  fields = req.query.fields or req.body.fields or []
  unless Array.isArray(fields)
    fields = fields.split(",")
  unless q
    return res.status(400).send
      error: "A query is requred"
  qTokens = q.split(',').map((s)-> s.trim())
  mainName = qTokens[0]
  mainNameTokens = mainName.split(' ').filter((s)->s)
  regionNames = qTokens.slice(1)
  client.search
    index: "geonames"
    type: "geoname"
    explain: explain == "true" || false
    _source: fields
    body:
      size: maxRows || 20
      query:
        bool:
          # Don't give a bonus mulitple for matching more of the following conditions.
          # disable_coord: true
          should: [
            # Rank high population places more highly
            range:
              population:
                boost: 0.5
                gt: 0
          ,
            range:
              population:
                boost: 0.5
                gte: 10000
          ,
            range:
              population:
                gte: 1000000
          ,
            # Match the name and alternatename fields. If there is a match in both, only
            # the highest scoring match is counted when computing relevance.
            dis_max:
              queries: [
                match:
                  name:
                    _name: "Main name"
                    query: mainName
                    fuzziness: "AUTO"
                    prefix_length: 1
              ,
                # Use prefix matching for type-ahead functionality.
                prefix:
                  rawNames: mainName
              ].concat(mainNameTokens.map((token, idx)->
                match:
                  rawNames:
                    boost: 1.5
                    query: mainNameTokens.slice(0, idx + 1).join(" ")
              ))
          ].concat(
            if regionNames.length == 0 and mainNameTokens.length > 0 then [
              multi_match:
                query: mainNameTokens.slice(1).join(" ")
                fields: [
                  "countryCode"
                  "admin1Code"
                  "countryName"
                  "admin1Name"
                  "admin2Name"
                ]
            ] else regionNames.map((regionName)->
              multi_match:
                query: regionName
                fields: [
                  "countryCode"
                  "admin1Code"
                  "countryName"
                  "admin1Name"
                  "admin2Name"
                ]
            )
          )
  .then (result)->
    res.json result.hits
  .catch next

###
@apiName Return Geonames By ID
@apiGroup Geonames
@api {get} /geonames Return Geonames By ID

@apiParam {String[]} ids
###
app.all '/api/geonames', (req, res, next)->
  res.header "Access-Control-Allow-Origin", "*"
  ids = req.query.ids or req.body.ids
  unless Array.isArray(ids)
    ids = ids.split(",")
  unless ids?.length > 0
    return res.status(400).send
      error: "ids are required"
  client.mget
    index: "geonames"
    type: "geoname"
    body:
      ids: ids
  .then (result)->
    res.json
      docs: result.docs.map (d)-> d._source
  .catch next

###
@apiName Geoname Query
@apiGroup Geonames
@api {get} /query Query geonames using the given criteria

@apiParam {String} featureCode
@apiParam {Number} limit=1000
###
app.all '/api/query', (req, res, next)->
  res.header "Access-Control-Allow-Origin", "*"
  featureCode = req.query.featureCode or req.body.featureCode
  limit = req.query.limit or req.body.limit
  unless featureCode
    return res.status(400).send
      error: "A featureCode is requred"
  client.search
    index: "geonames"
    type: "geoname"
    _source: []
    body:
      size: limit || 1000
      query:
        bool:
          must: [
            match:
              featureCode:
                query: featureCode
          ]
  .then (result)->
    res.json result.hits
  .catch next

ipaddr = process.env.IP or "0.0.0.0"
port = process.env.PORT or 80
app.listen port, ipaddr, ->
  console.log "#{Date.now()}: Node server started on #{ipaddr}:#{port} ..."
