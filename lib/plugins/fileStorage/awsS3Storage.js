'use strict';

var aws = require('aws-sdk');
var through2 = require('through2');

class awsS3Storage {
  /**
   * @param {object} options - A hash of options.
   * @param {string} options.fileStorage - The path in which to store the files.
   */
  constructor(options) {
    this.fileStorage = options;
    aws.config.accessKeyId = options.awsAccessKeyId;
    aws.config.secretAccessKey = options.awsSecretAccessKey;
    this.s3obj = new aws.S3({params: {Bucket: options.bucket}});
    var throughStream = through2();
  }

  /**
   * Create a writeable stream to which we can write file data.
   *
   * @param {string} assetName - The name of the asset that needs to be written.
   * @return {object} - The writeable stream to store the data.
   */
  createWriteStream(assetName) {
    var writeStream = through2();
    var self = this;
    self.s3obj.upload({Key: assetName, Body: writeStream})
      .send(function (err, data) {
      });
    return writeStream;
  }

  /**
   * Create a readable stream to which we can write file data.
   *
   * @param {string} assetName - The name of the asset that needs to be written.
   * @return {object} - The writeable stream to store the data.
   */
  createReadStream(assetName) {
    var writeStream = through2();
    var self = this;
    self.s3obj.upload({Key: assetName, Body: writeStream})
      .send(function (err, data) {
      });
    return writeStream;
  }

}
module.exports = awsS3Storage;
