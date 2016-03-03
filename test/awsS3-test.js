'use strict';
var through2 = require('through2');
var split2 = require('split2');
var bunyan = require('bunyan');
var fs = require('fs');
var mock = require('mock-require');
mock('aws-sdk', 'mock-aws-s3');

var app = require('..');
var AwsS3Storage = app.lib.plugins.fileStorage.AwsS3Storage;

describe('AWS file sotrage plugin', function() {
  describe('create write stream', function() {
    it('should successfully store and retrieve a file', function(done) {

      var awsOptions = {
        awsAccessKeyId: 'anyAccessKeyId',
        awsSecretAccessKey: 'anySecretAccessKey',
        awsBucket: 'anyBucket',
      };
      var logger = bunyan.createLogger({
        name: 'tests',
        level: 'fatal',
        stream: fs.createWriteStream('/dev/null'),
      });
      var awsStore = new AwsS3Storage(awsOptions, logger);
      awsStore.s3.upload = function(search, options, callback) {
        if (typeof options === 'function' && !callback) {
          callback = options;
          options = null;
        }
        var self = this;
        return {
          send: function(cb) {
            if (!cb && callback) {
              cb = callback;
            }
            return self.putObject(search, cb);
          },
        };
      };
      var assetId = 'testUpload-' + Date.now() + '.txt';

      var uploadComplete = function(error) {
        var dataRead = [];
        var readStream = awsStore.createReadStream(assetId);

        var reader = function(data, enc, callback) {
          dataRead.push(data.toString('utf8'));
          callback(null, data);
        };
        var checker = function() {
          dataRead.length.should.equal(2);
          dataRead[0].should.equal('One line');
          dataRead[1].should.equal('Two lines');
          done();
        };
        readStream
          .pipe(split2())
          .pipe(through2(reader, checker));
      };

      var writeStream = awsStore.createWriteStream(assetId, uploadComplete);

      writeStream.write('One line\n');
      writeStream.write('Two lines\n');
      writeStream.end();
    });
  });
});
