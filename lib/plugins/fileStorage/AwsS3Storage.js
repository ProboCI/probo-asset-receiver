'use strict';

var aws = require('aws-sdk');
var through2 = require('through2');

class AwsS3Storage {
  /**
   * @param {object} options - A hash of options.
   * @param {string} options.fileStorage - The path in which to store the files.
   */
  constructor(options) {
    aws.config.accessKeyId = options.awsAccessKeyId;
    aws.config.secretAccessKey = options.awsSecretAccessKey;
    this.s3obj = new aws.S3({params: {Bucket: options.fileDataDirectory}});
  }

  /**
   * Create a writeable stream to which we can write file data.
   *
   * @param {string} assetName - The name of the asset that needs to be written.
   * @return {object} - The writeable stream to store the data.
   */
  createWriteStream(assetName) {
    var writeStream = through2();
    this.s3obj.upload({Key: assetName, Body: writeStream})
      .send(function (err, data) {
        if (err)
          console.log(err)
        else
          console.log("Successfully uploaded data to amazon S3");
      });
    return writeStream;
  }


}
module.exports = AwsS3Storage;
