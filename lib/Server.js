var express = require('express'),
    bodyParser = require('body-parser'),
    bunyanExpress = require('express-bunyan-logger'),
    through2 = require('through2'),
    Asset = require('./Asset'),
    LevelDB = require('./plugins/database/LevelDB'),
    FlakeId = require('flake-idgen'),
    format  = require('biguint-format'),
    fs = require('fs'),
    path = require('path')
    zlib = require('zlib')
;

var Server = function(options) {
  this.options = options || {};
  this.logger = this.options.logger || null;
  this.database = this.options.database || new LevelDB(this.options);

  // Used to generate IDs for asset uploads.
  this.flakeIdGen = new FlakeId();

  this.setup = this.setup.bind(this);
  this.start = this.start.bind(this);
  this.stop = this.stop.bind(this);

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
  app.post('/buckets/:bucket/token/:token', this.routes.createBucketToken);
  app.post('/asset/:token/:assetName', this.routes.receiveFileAsset);
  app.get('/asset/:bucket/:assetName', this.routes.serveFileAsset);


  this.app = app;
};

Server.prototype.start = function(done) {
  this.server = this.app.listen(this.options.port, this.options.host, function(error) {
    if (done) {
      done(error);
    }
  });
  return this.server;
};

Server.prototype.stop = function(done) {
  this.server.close(done);
};

Server.prototype.serveDataStream = function(keyName, valueName) {
  var first = true;
  return through2.obj(function(item, enc, cb) {
    prefix = '  ';
    if (!first) {
      prefix = ',\n  ';
    }
    first = false;
    this.push(prefix + '"' + item[keyName] + '": ' + JSON.stringify(item[valueName]));
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
  res.writeHead(200, { 'Content-Type': 'application/JSON' });
  res.write('{\n');
  var first = true;
  readStream
    .pipe(this.serveDataStream('bucket', 'data'))
    .pipe(res, { end: false });
  readStream.on('end', function() {
    res.end('\n}');
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
  self.database.getBucket(bucket, function(error, data) {
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

Server.prototype.routes.receiveFileAsset = function(req, res, done) {
  var self = this;
  var token = req.params.token;
  var assetName = req.params.assetName;
  self.database.getBucketFromToken(token, function(error, bucket) {
    if (error) {
      return res
        .status(403)
        .send('Invalid token');
    }
    var assetId = format(self.flakeIdGen.next(), 'hex');
    metadata = {
      token: token,
      time: Date.now(),
      // Content type? File name?
    };
    self.database.createAsset(bucket, assetName, assetId, metadata, done);
     res.writeHead(201, { 'Content-Type': 'text/plain' });
     req
      .pipe(zlib.createGzip())
      .pipe(fs.createWriteStream(path.join(self.options.fileDataDirectory, assetId), { encoding: 'binary' }));
     req.on('end', function() {
       res.end(assetId);
     });
  });
};

Server.prototype.routes.serveFileAsset = function(req, res, done) {
  var self = this;
  var bucket = req.params.bucket;
  var assetName = req.params.assetName;
  self.database.getAssetId(bucket, assetName, function(error, assetId) {
    if (error) {
      res.writeHead(404);
      return res.end('Not Found');
    }
    res.writeHead(200);
    fs.createReadStream(path.join(self.options.fileDataDirectory, assetId))
      .pipe(zlib.createGunzip())
      .pipe(res);
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
