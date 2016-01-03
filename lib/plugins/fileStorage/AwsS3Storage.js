'use strict';

var aws = require('aws-sdk');
var through2 = require('through2');

class AwsS3Storage {
  /**
   * @param {object} options - A hash of options.
   * TODO: LIST THE OPTIONS USED
   */
  constructor(options) {
    aws.config.accessKeyId = options.awsAccessKeyId;
    aws.config.secretAccessKey = options.awsSecretAccessKey;
    this.awsBucket = options.awsBucket;
    this.s3 = new aws.S3({params: {Bucket: options.awsBucket}});
  }

  /**
   * Create a writeable stream to which we can write file data.
   *
   * @param {string} assetName - The name of the asset that needs to be written.
   * @return {object} - The writeable stream to store the data.
   */

  createWriteStream(assetName, done) {
    var writeStream = through2();
    var awsBucket =  this.awsBucket;
    this.s3.upload({Key: assetName, Body: writeStream})
      .send(function (error, data) {
        if (error) {
          console.log(error);
        }
        else {
          // TODO: Log using bunyan logger (which should be passed into the constructor as an option
          console.log("Successfully uploaded asset: " + assetName + " to the bucket: " + awsBucket + " in aws S3");
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
      .createReadStream()
  }
}

module.exports = AwsS3Storage;
