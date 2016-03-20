'use strict';

var aws = require('aws-sdk');
var through2 = require('through2');

class AwsS3Storage {

  /**
   * @param {object} options - A hash of options.
   * @param {String} Amazon access key
   * @param {String} Amazon secret access key
   * @param {String} Amazon bucketname
   * @param {logger}  logger instance to use.

   */

  constructor(options, logger) {
    aws.config.accessKeyId = options.awsAccessKeyId;
    aws.config.secretAccessKey = options.awsSecretAccessKey;
    this.awsBucket = options.awsBucket;
    this.s3 = new aws.S3({params: {Bucket: options.awsBucket}});
    this.logger = logger;
  }

  /**
   * Create a writeable stream to which we can write file data.
   *
   * @param {string} assetName - The name of the asset that needs to be written.
   * @param {function} done - Callback.
   * @return {object} - The writeable stream to store the data.
   */
  createWriteStream(assetName, done) {
    var writeStream = through2();
    var request = this.s3.upload({Key: assetName, Body: writeStream});
    var self = this;
    request.send(function(error, data) {
      // We must alert the write stream that we have finished or it will
      // not close the connection to the client.
      writeStream.emit('close');
      if (error) {
        self.logger.error(error);
      }
      if (done) {
        return done(error);
      }
    });
    return writeStream;
  }

  /**
   * Create a readable stream to which we can read file data.
   *
   * @param {string} assetName - The name of the asset that needs to be written.
   * @return {object} - The readable stream to store the data.
   */

  createReadStream(assetName) {
    var params = {Bucket: this.awsBucket, Key: assetName};
    return this.s3
      .getObject(params)
      .createReadStream();
  }

  deleteFile(assetId, done) {
    var params = {Bucket: this.awsBucket, Key: assetId};
    return this.s3.deleteObject(params, function(err, data) {
      done(err, data);
    });
  }
}

module.exports = AwsS3Storage;
