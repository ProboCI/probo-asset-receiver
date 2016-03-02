'use strict';

var should = require('should');
var os = require('os');
var path = require('path');
var request = require('request');
var memdown = require('memdown');
var bunyan = require('bunyan');
var fs = require('fs');
var supertest = require('supertest');
var zlib = require('zlib');

var app = require('..');
var Server = app.lib.Server;

// extend supertest Test class to have a .token method so that we can chain
// adding an authorization Bearer token easily
require('supertest/lib/test').prototype.token = function(token) {
  this.set('Authorization', 'Bearer ' + token);
  return this;
};

var createServer = function(options) {
  var tempDir = path.join(os.tmpdir(), 'probo-asset-receiver-' + Date.now());
  var defaultOptions = {
    databasePlugin: 'LevelDB',
    databaseConfig: {
      databaseDataDirectory: tempDir,
      levelDB: memdown,
    },
    fileStoragePlugin: 'LocalFiles',
    fileStorageConfig: {
      fileDataDirectory: tempDir,
    },
    host: '0.0.0.0',
    encryptionCipher: 'aes-256-cbc',
    encryptionPassword: 'super-secret',
    logger: bunyan.createLogger({
      name: 'tests',
      level: 'fatal',
      stream: fs.createWriteStream('/dev/null'),
    }),
  };

  options = options || {};
  for (var i in options) {
    if (options.hasOwnProperty(i)) {
      defaultOptions[i] = options[i];
    }
  }

  return new Server(defaultOptions);
};


describe('http-auth', function() {
  // create a server with auth enabled
  var server = createServer({tokens: ['tik', 'tok']});

  var http = function() {
    return supertest(server.app);
  };

  before('start server', function(done) {
    server.start(done);
  });

  describe('routes require authentication', function() {
    it('GET /buckets (no auth token)', function(done) {
      http().get('/buckets').expect(401, done);
    });

    it('GET /buckets (invalid token)', function(done) {
      http().get('/buckets').token('blah').expect(401, done);
    });

    it('GET /buckets/:bucket', function(done) {
      http().get('/buckets/:bucket').expect(401, done);
    });

    it('POST /buckets/:bucket', function(done) {
      http().post('/buckets/:bucket').expect(401, done);
    });

    it('POST /buckets/:bucket/token/:token', function(done) {
      http().post('/buckets/:bucket/token/:token').expect(401, done);
    });

    it('DELETE /buckets/:bucket/token/:token', function(done) {
      http().delete('/buckets/:bucket/token/:token').expect(401, done);
    });

    it('DELETE /buckets/:bucket/asset/:assetName', function(done) {
      http().delete('/buckets/:bucket/asset/:assetName').expect(401, done);
    });

    it('GET /buckets/:bucket/token', function(done) {
      http().get('/buckets/:bucket/token').expect(401, done);
    });

    it('GET /asset/:bucket/:assetName', function(done) {
      http().get('/asset/:bucket/:assetName').expect(401, done);
    });

    it('GET /buckets/:bucket/assets', function(done) {
      http().get('/buckets/:bucket/assets').expect(401, done);
    });

  });

  describe('authenticated route accepts valide auth token ', function() {
    it('GET /buckets', function(done) {
      http().get('/buckets').token('tik').expect(200, done);
    });
  });

  describe('routes that do NOT require authentication', function() {
    it('POST /asset/:token/:assetName', function(done) {
      // a 403 error means asset token is invalid, not an authentication token
      http().post('/asset/:token/:assetName').expect(403, done);
    });
  });
});

describe('http-api', function() {
  var server = null;
  var port = null;

  var getOptions = function(path) {
    var options = {
      url: 'http://localhost:' + port + path,
      json: true,
    };
    return options;
  };

  before(function(done) {
    server = createServer();
    var listener = server.start(function() {
      port = listener.address().port;
      done();
    });
  });
  after(function(done) {
    server.stop(done);
  });

  describe('server', function() {
    it('should listen on a designated port and report its identity', function(done) {
      request(getOptions('/'), function(error, response, body) {
        response.statusCode.should.equal(200);
        body.should.equal('Probo asset receiver');
        done();
      });
    });
    it('should use throw an error if the default database is used and a data path is not specified', function() {
      (function() {
        new Server();
      }).should.throw();
    });
  });

  describe('create-bucket', function() {
    describe('manage buckets', function() {
      it('should receive a 404 for a nonexistent bucket', function(done) {
        request(getOptions('/buckets/foo'), function(error, response, body) {
          should.not.exist(error);
          response.statusCode.should.equal(404);
          done();
        });
      });
      it('should create a new bucket and be able to retrieve it', function(done) {
        var options = getOptions('/buckets/foo');
        options.body = {
          bar: 'baz',
        };
        request.post(options, function(error, response, body) {
          request(getOptions('/buckets'), function(error, response, body) {
            should.exist(body.foo);
            body.foo.bar.should.equal('baz');
            request(getOptions('/buckets/foo'), function(error, response, body) {
              body.bar.should.equal('baz');
              done();
            });
          });
        });
      });
      it('should list multiple buckets if they exist', function(done) {
        request.post(getOptions('/buckets/bar'), function(error, response, body) {
          request(getOptions('/buckets'), function(error, response, body) {
            should.not.exist(error);
            should.exist(body.foo);
            should.exist(body.bar);
            done();
          });
        });
      });
      it('should handle an error if one occurs while creating a bucket', function(done) {
        var _createBucket = server.database.createBucket;
        server.database.createBucket = function(bucket, data, cb) {
          cb(new Error('Oh Noes!'));
        };
        request.post(getOptions('/buckets/fail'), function(error, response, body) {
          response.statusCode.should.equal(500);
          server.database.createBucket = _createBucket;
          done();
        });
      });
    });

    describe('manage tokens', function() {
      it('should create a token and retrieve it in a list of tokens', function(done) {
        request.post(getOptions('/buckets/foo/token/bar'), function(error, response, body) {
          request.post(getOptions('/buckets/foo/token/baz'), function(error, response, body) {
            request(getOptions('/buckets/foo/token'), function(error, response, body) {
              should.not.exist(error);
              body[0].should.equal('bar');
              body[1].should.equal('baz');
              done();
            });
          });
        });
      });
      it('should return a 403 when trying to create a token in a nonexistent bucket', function(done) {
        request.post(getOptions('/buckets/baz/token/robot'), function(error, response, body) {
          response.statusCode.should.equal(403);
          done();
        });
      });
      it('should handle an error if one occurs while creating a bucket token', function(done) {
        var _createBucketToken = server.database.createBucketToken;
        server.database.createBucketToken = function(bucket, token, cb) {
          cb(new Error('Oh Noes!'));
        };
        request.post(getOptions('/buckets/foo/token/disco'), function(error, response, body) {
          response.statusCode.should.equal(500);
          server.database.createBucketToken = _createBucketToken;
          done();
        });
      });
      it('should delete a token an no longer see it listed in the bucket', function(done) {
        request(getOptions('/buckets/foo/token'), function(error, response, body) {
          body[0].should.equal('bar');
          body[1].should.equal('baz');
          request.del(getOptions('/buckets/foo/token/bar'), function(error, response, body) {
            response.statusCode.should.equal(202);
            request(getOptions('/buckets/foo/token'), function(error, response, body) {
              body[0].should.equal('baz');
              done();
            });
          });
        });
      });
      it('should handle an error in the deletion process', function(done) {
        var _deleteBucketToken = server.database.deleteBucketToken;
        server.database.deleteBucketToken = function(bucket, token, cb) {
          return cb(new Error('Oh noes!'));
        };
        request.del(getOptions('/buckets/foo/token/bar'), function(error, response, body) {
          response.statusCode.should.equal(500);
          server.database.deleteBucketToken = _deleteBucketToken;
          done();
        });
      });
    });
  });

  describe('upload asset', function() {
    it('should receive a 403 if an invalid token is used for an upload', function(done) {
      request.post(getOptions('/asset/bazr/foo.json'), function(error, response, body) {
        response.statusCode.should.equal(403);
        body.should.equal('Invalid token');
        done();
      });
    });
    it('should receive a file asset uploaded with a token and serve the file back', function(done) {
      var options = getOptions('/asset/baz/package.json');
      var submitStream = request.post(options, function(err, res, body) {
        res.statusCode.should.equal(201);
        done();
      });
      fs.createReadStream(__dirname + '/../package.json').pipe(submitStream);
    });
    it('should receive a file\'s contents once uploaded', function(done) {
      var options = getOptions('/asset/foo/package.json');
      options.json = false;
      request(options, function(error, response, body) {
        body.should.equal(fs.readFileSync(__dirname + '/../package.json').toString('utf8'));
        done();
      });
    });
    it('should serve a 404 if an invalid asset is requested', function(done) {
      request(getOptions('/asset/foo/no-file.png'), function(error, response, body) {
        response.statusCode.should.equal(404);
        body.should.equal('Not Found');
        done();
      });
    });
  });

  describe('Asset Data', function() {
    it('should receive a file\'s rawSize and zippedSize size.', function(done) {
      var options = getOptions('/asset-size/foo/package.json');
      request(options, function(error, response, body) {
        var filePath = __dirname + '/../package.json';
        var content = fs.readFileSync(filePath, 'utf8');
        var fileStat = fs.statSync(filePath);
        body.zippedSize.should.equal(zlib.gzipSync(content).length);
        body.rawSize.should.equal(fileStat.size);

        done();
      });
    });
    it('should list asset metadata for a bucket', function(done) {
      var options = getOptions('/buckets/foo/assets');
      request(options, function(error, response, body) {
        Array.isArray(body).should.be.true();
        body.length.should.equal(1);
        var metadata = body[0];
        metadata.fileName.should.equal('package.json');

        metadata.zippedSize.should.be.a.Number();
        metadata.zippedSize.should.be.above(0);

        metadata.rawSize.should.be.a.Number();
        metadata.rawSize.should.be.above(0);

        metadata.time.should.be.a.Number(0);
        metadata.time.should.be.above(0);
        done();
      });
    });
  });

  describe('Asset Removal', function() {
    var foundAssetId = null;
    it('should have the bucket asset before it is deleted.', function(done) {
      server.database.getAssetId('foo', 'package.json', function(err, assetId) {
        should.not.exist(err);
        foundAssetId = assetId;
        assetId.should.be.a.String();
        assetId.length.should.equal(16);
        done();
      });
    });
    it('should have the file asset before it is deleted.', function(done) {
      var file = server.fileStorage.createReadStream(foundAssetId);
      file.on('data', function(data) {
        data.length.should.be.above(0);
        done();
      });
    });
    it('should respond to a DELETE request.', function(done) {
      var options = getOptions('/buckets/foo/asset/package.json');
      request.del(options, function(error, response, body) {
        response.statusCode.should.equal(202);
        body.should.equal('Asset removed.');
        done();
      });
    });
    it('should no longer contain bucket asset database data.', function(done) {
      server.database.getAssetId('foo', 'package.json', function(err, assetId) {
        should.not.exist(assetId);
        done();
      });
    });
    it('should no longer contain asset database data.', function(done) {
      server.database.getAssetMetadata(foundAssetId, function(err, data) {
        should.not.exist(data);
        done();
      });
    });
    it('should no longer contain bucket-asset-version database data.', function(done) {
      server.database.getBucketAssetVersion('foo', 'package.json', foundAssetId, function(err, data) {
        should.not.exist(data);
        done();
      });
    });
    it('should delete a file.', function(done) {
      var file = server.fileStorage.createReadStream(foundAssetId);
      file.on('error', function(err) {
        err.message.should.startWith('ENOENT: no such file or directory');
        done();
      });
    });
  });
});
