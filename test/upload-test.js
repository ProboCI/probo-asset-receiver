var should = require('should'),
    os = require('os'),
    path = require('path'),
    request = require('request'),
    memdown = require('memdown');

var app = require('..');
var Server = app.lib.Server;

var server = null;
var tempDir = null;
var port = null;

var getOptions = function(path, method) {
 var options = {
    url: 'http://localhost:' + port + path,
    json: true,
  };
  return options;
};

describe('http-api', function() {
  before(function(done) {
    tempDir = path.join(os.tmpdir(), 'probo-asset-receiver-' + Date.now());
    var options = {
      databaseDataDirectory: tempDir,
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
  describe('create-bucket', function() {
    describe('create a new bucket', function() {
      it('should create a new bucket and be able to retrieve it', function(done) {
 ;
        request.post(getOptions('/buckets/foo'), function(error, response, body) {
          request(getOptions('/buckets'), function(error, response, body) {
            should.exist(body.foo);
            done();
          });
        });
      });
    });
    describe('create a new token', function() {
    });
  });
});
