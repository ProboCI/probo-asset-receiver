var express = require('express'),
    bodyParser = require('body-parser'),
    bunyanExpress = require('express-bunyan-logger'),
    through2 = require('through2'),
    Asset = require('./Asset'),
    LevelDB = require('./plugins/database/LevelDB')
;
    

var Server = function(options) {
  this.options = options || {};
  this.logger = options.logger;
  this.database = options.database || new LevelDB(options);

  this.setup = this.setup.bind(this);
  this.start = this.start.bind(this);

  var name = null;
  for (name in this.routes) {
    this.routes[name] = this.routes[name].bind(this);
  }

  this.setup();
};

Server.prototype.setup = function() {
  var self = this;
  var express = require('express');
  var app = express();
  var loggerOptions = {
    logger: this.options.logger,
  };
  //app.use(bunyanExpress(loggerOptions));
  //app.use(bunyanExpress.errorLogger(loggerOptions));

  app.get('/', function (req, res) {
    res.send('');
  });

  app.get('/buckets', this.routes.listBuckets);
  app.get('buckets/:bucket', this.routes.getBucket);
  app.post('/buckets/:bucket', bodyParser.json(), this.routes.createBucket);
  app.post('/buckets/:bucket/token/:token', bodyParser.json(), this.routes.createBucketToken);


  this.app = app;
   
};

Server.prototype.start = function(done) {
  this.app.listen(this.options.port, this.options.host, function(error) {
    if (done) {
      done(error);
    }
  });
};

Server.prototype.serveDataStream = function(keyName, valueName) {
  return through2.obj(function(item, enc, cb) {
    first = false;
    prefix = '  ';
    if (!first) {
      prefix = ',\n  ';
    }
    this.push('  "' + item[keyName] + '": ' + JSON.stringify(item[valueName]) + ',\n');
    cb();
  });
};

Server.prototype.routes = {};

Server.prototype.routes.getBucket = function(req, res, done) {
  this.db.getBucket(req.params.bucket, function(error, data) {
    if (error) {
      return res
        .status(404)
        .send('Bucket not found');
    }
    res.json(data);
  });
};

Server.prototype.routes.listBuckets = function(req, res, done) {
  readStream = this.database.listBuckets();
  res.writeHead(200);
  res.write('[\n');
  var first = true;
  readStream
    .pipe(this.serveDataStream('bucket', 'data'))
    .pipe(res, { end: false });
  readStream.on('end', function() {
    res.end(']');
  });
};

Server.prototype.routes.createBucket = function(req, res, done) {
  var self = this;
  var bucket = req.params.bucket;
  self.database.createBucket(bucket, req.body, function(error) {
    if (error) return this.handleError(req, res, error);
    res
      .status(201)
      .send('Bucket created');
  });
};

Server.prototype.routes.createBucketToken = function(req, res, done) {
  var self = this;
  var bucket = req.params.bucket;
  var token = req.params.token;
  self.database.getBucket(bucket, function(error, bucket) {
    if (error) {
      return res
        .status(403)
        .send('Bucket not found');
    }
    self.database.createBucketToken(bucket, token, function(error) {
      if (error) return this.handleError(req, res, error);
      res
        .status(201)
        .send('Token created');
    });
  });
};

Server.prototype.handleError = function(req, res, error) {
  self.log('An error occurred creating bucket ' + bucket, error);
    res
      .status(500)
      .json({ error: 'An error occurred.'});
    return done(error);
};

module.exports = Server;
