'use strict';

var path = require('path');
var fs = require('fs');

class LocalFiles {

  /**
   * @param {object} options - A hash of options.
   * @param {string} options.fileDataDirectory - The path in which to store the files.
   * @param {logger}  logger instance to use.


   */
  constructor(options, logger) {
    this.fileDataDirectory = options.fileDataDirectory;
    this.logger = logger;
  }

  /**
   * Create a writeable stream to which we can write file data.
   *
   * @param {string} assetId - The id of the asset that needs to be written.
   * @return {object} - The writeable stream to store the data.
   */
  createWriteStream(assetId) {
    return fs.createWriteStream(path.join(this.fileDataDirectory, assetId), {encoding: 'binary'});
  }

  /**
   * Create a readable stream to which we can write file data.
   *
   * @param {string} assetId - The id of the asset that needs to be written.
   * @return {object} - The writeable stream to store the data.
   */
  createReadStream(assetId) {
    return fs.createReadStream(path.join(this.fileDataDirectory, assetId), {encoding: 'binary'});
  }

  deleteFile(assetId, done) {
    fs.unlink(path.join(this.fileDataDirectory, assetId), function(err) {
      done(err);
    });
  }
}

module.exports = LocalFiles;
