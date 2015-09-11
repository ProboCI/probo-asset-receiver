var should = require('should'),
    os = require('os'),
    path = require('path'),
    request = require('request'),
    memdown = require('memdown'),
    bunyan = require('bunyan'),
    fs = require('fs');

var app = require('..');
var Server = app.lib.Server;

var server = null;
var tempDir = null;
var port = null;

var getOptions = function(path, method) {
 var options = {
    url: 'http://localhost:' + port + path,
    json: true,
    logger: bunyan.createLogger({
      name: 'tests',
      level: 'fatal',
      stream: fs.createWriteStream('/dev/null'),
    }),
  };
  return options;
};

describe('http-api', function() {
  before(function(done) {
    tempDir = path.join(os.tmpdir(), 'probo-asset-receiver-' + Date.now());
    var options = {
      databaseDataDirectory: tempDir,
      fileDataDirectory: tempDir,
      host: '0.0.0.0',
      levelDB: memdown,
    };
    server = new Server(options);
    var listener = server.start(function() {
      port = listener.address().port;
      done();
    })
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
    it('should receive a file asset uploaded wiht a token and serve the file back', function(done) {
      var submitStream = request.post(getOptions('/asset/baz/package.json'))
      .on('response', function(response) {
        response.statusCode.should.equal(201);
        done();
      })
      fs.createReadStream(__dirname + '/../package.json').pipe(submitStream);
    });
    it('should receive a file\'s contents  once uplaoded', function(done) {
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
});
