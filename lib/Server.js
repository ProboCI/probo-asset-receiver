'use strict';
var express = require('express');
var bodyParser = require('body-parser');
var bunyan = require('bunyan');
var bunyanExpress = require('express-bunyan-logger');
var through2 = require('through2');
var FlakeId = require('flake-idgen');
var format = require('biguint-format');
var zlib = require('zlib');
var crypto = require('crypto');
var plugins = require('./plugins');

var Server = function (options) {
  this.options = options || {
      encryptionCipher: 'aes-256-cbc',
      encryptionPassword: 'SECRET',
    };
  this.options.databasePlugin = this.options.databasePlugin || 'LevelDB';
  this.options.fileStoragePlugin = this.options.fileStoragePlugin || 'LocalFiles';
  this.database = new plugins.database[this.options.databasePlugin](this.options.databaseConfig);
  this.logger = this.options.logger || bunyan.createLogger({name: 'probo-asset-receiver'});
  this.fileStorage = new plugins.fileStorage[this.options.fileStoragePlugin](this.options.fileStorageConfig, this.logger);
  // Used to generate IDs for asset uploads.
  this.flakeIdGen = new FlakeId();

  this.setup = this.setup.bind(this);
  this.start = this.start.bind(this);
  this.stop = this.stop.bind(this);
  this.handleError = this.handleError.bind(this);

  for (let name in this.routes) {
    if (this.routes.hasOwnProperty(name)) {
      this.routes[name] = this.routes[name].bind(this);
    }
  }

  this.setup();
};

Server.prototype.setup = function () {
  var app = express();
  var loggerOptions = {
    logger: this.logger,
  };
  app.use(bunyanExpress(loggerOptions));
  app.use(bunyanExpress.errorLogger(loggerOptions));

  app.get('/', function (req, res) {
    res.send('Probo asset receiver');
  });

  app.get('/buckets', this.routes.listBuckets);
  app.get('/buckets/:bucket', this.routes.getBucket);
  app.post('/buckets/:bucket', bodyParser.json(), this.routes.createBucket);
  app.post('/buckets/:bucket/token/:token', this.routes.createBucketToken);
  app.delete('/buckets/:bucket/token/:token', this.routes.deleteBucketToken);
  app.get('/buckets/:bucket/token', this.routes.listBucketTokens);
  app.post('/asset/:token/:assetName', this.routes.receiveFileAsset);
  app.get('/asset/:bucket/:assetName', this.routes.serveFileAsset);


  this.app = app;
};

Server.prototype.start = function (done) {
  this.server = this.app.listen(this.options.port, this.options.host, function (error) {
    if (done) {
      done(error);
    }
  });
  return this.server;
};

Server.prototype.stop = function (done) {
  this.server.close(done);
};

/**
 * Serves a stream of data from the storage backend.
 *
 * @param {string} keyName - The name of the key to serve in the object being rendered.
 * @param {string} valueName - The name of the value key to serve in the object being rendered.
 * @return {object} - A transform stream that renders a stream of records based on key and value.
 */
Server.prototype.serveDataStream = function (keyName, valueName) {
  var first = true;
  return through2.obj(function (item, enc, cb) {
    var prefix = '  ';
    if (!first) {
      prefix = ',\n  ';
    }
    first = false;
    this.push(prefix + '"' + item[keyName] + '": ' + JSON.stringify(item[valueName]));
    cb();
  });
};

/**
 * Contains route callbacks.
 */
Server.prototype.routes = {};

Server.prototype.routes.getBucket = function (req, res, done) {
  this.database.getBucket(req.params.bucket, function (error, data) {
    if (error) {
      return res
        .status(404)
        .send('Bucket not found');
    }
    res.json(data);
  });
};

Server.prototype.routes.listBuckets = function (req, res, done) {
  var readStream = this.database.listBuckets();
  res.writeHead(200, {'Content-Type': 'application/JSON'});
  res.write('{\n');
  readStream
    .pipe(this.serveDataStream('bucket', 'data'))
    .pipe(res, {end: false});
  readStream.on('end', function () {
    res.end('\n}');
  });
};

Server.prototype.routes.listBucketTokens = function (req, res, done) {
  var readStream = this.database.listBucketTokens(req.params.bucket);
  res.writeHead(200, {'Content-Type': 'application/JSON'});
  res.write('[\n');
  var first = true;
  readStream
    .pipe(through2(function (data, enc, cb) {
      var prefix = ',';
      if (first) {
        prefix = '';
        first = false;
      }
      this.push(prefix + '  "' + data + '"');
      cb();
    }))
    .pipe(res, {end: false});
  readStream.on('end', function () {
    res.end('\n]');
  });
};

Server.prototype.routes.createBucket = function (req, res, done) {
  var self = this;
  var bucket = req.params.bucket;
  self.database.createBucket(bucket, req.body, function (error) {
    if (error) return self.handleError(req, res, error);
    self.logger.info('Created bucket ' + bucket, {bucket: bucket});
    res
      .status(201)
      .send('Bucket created');
  });
};

Server.prototype.routes.createBucketToken = function (req, res, done) {
  var self = this;
  var bucket = req.params.bucket;
  var token = req.params.token;
  self.database.getBucket(bucket, function (error, data) {
    if (error) {
      self.logger.warn('Bucket not found ' + bucket + ' when attempting to create ' + token, {bucket: bucket, token: token});
      return res
        .status(403)
        .send('Bucket not found');
    }
    self.database.createBucketToken(bucket, token, function (error) {
      if (error) return self.handleError(req, res, error);
      self.logger.info('Token ' + token + ' created in bucket ' + bucket, {bucket: bucket, token: token});
      res
        .status(201)
        .send('Token created');
    });
  });
};

Server.prototype.routes.deleteBucketToken = function (req, res, done) {
  var self = this;
  var bucket = req.params.bucket;
  var token = req.params.token;
  self.database.deleteBucketToken(bucket, token, function (error, data) {
    if (error) return self.handleError(req, res, error);
    self.logger.info('Token ' + token + ' deleted from bucket ' + bucket, {bucket: bucket, token: token});
    res.writeHead(202);
    res.end('Token deleted.');
  });
};

Server.prototype.routes.receiveFileAsset = function (req, res, done) {
  var self = this;
  var token = req.params.token;
  var assetName = req.params.assetName;
  self.database.getBucketFromToken(token, function (error, bucket) {
    if (error) {
      self.logger.warn('Bucket not found ' + bucket + ' when attempting to use token ' + token, {bucket: bucket, token: token});
      return res
        .status(403)
        .send('Invalid token');
    }
    var assetId = format(self.flakeIdGen.next(), 'hex');
    var rawBytes = 0;
    var zippedBytes = 0;
    var metadata = {
      token: token,
      time: Date.now(),
      // Content type? File name?
    };
    self.database.createAsset(bucket, assetName, assetId, metadata, function (error) {
      if (error) {
        self.logger.warn('Bucket not found ' + bucket + ' when attempting to use token ' + token, {bucket: bucket, token: token});
        return res
          .status(403)
          .send('Invalid token');
      }
      self.logger.info('Asset ' + assetName + ' uploading to bucket bucket ' + bucket + ' using token ' + token, {bucket: bucket, token: token, assetName: assetName});
      res.writeHead(201, {'Content-Type': 'text/plain'});
      req
        .pipe(through2(function (data, enc, cb) {
          rawBytes += data.length;
          this.push(data);
          cb();
        }))
        .pipe(zlib.createGzip())
        .pipe(crypto.createCipher(self.options.encryptionCipher, new Buffer(self.options.encryptionPassword)))
        .pipe(through2(function (data, enc, cb) {
          zippedBytes += data.length;
          this.push(data);
          cb();
        }))
        .pipe(self.fileStorage.createWriteStream(assetId))
        .on('close', function () {
          metadata.rawSize = rawBytes;
          metadata.zippedSize = zippedBytes;
          self.database.updateAsset(bucket, assetName, assetId, metadata, function (error) {
            if (error) {
              res.status(400).send(error.message);
              return console.error(error);
            }
            self.logger.info('Asset ' + assetName + ' uploaded to bucket bucket ' + bucket + ' using token ' + token, {bucket: bucket, token: token, assetName: assetName});
            res.end(assetId);
          });
        });
    });
  });
};

Server.prototype.routes.serveFileAsset = function (req, res, done) {
  var self = this;
  var bucket = req.params.bucket;
  var assetName = req.params.assetName;
  self.database.getAssetId(bucket, assetName, function (error, assetId) {
    if (error) {
      self.logger.warn('Asset ' + assetName + ' not found in bucket ' + bucket + ' during download.', {bucket: bucket, assetName: assetName});
      res.writeHead(404);
      return res.end('Not Found');
    }

    self.logger.info('Asset ' + assetName + ' from bucket ', bucket, ' requested');

    res.writeHead(200);
    self.fileStorage.createReadStream(assetId)
      .pipe(crypto.createDecipher(self.options.encryptionCipher, self.options.encryptionPassword))
      .pipe(zlib.createGunzip())
      .pipe(res);

    res.on('finish', function () {
      self.logger.info('Asset ' + assetName + ' from bucket ', bucket, ' sent');
    });
  });
};

Server.prototype.handleError = function (req, res, error) {
  var self = this;
  self.logger.info('An error occurred', error);
  res
    .status(500)
    .json({error: 'An error occurred.'});
};

module.exports = Server;