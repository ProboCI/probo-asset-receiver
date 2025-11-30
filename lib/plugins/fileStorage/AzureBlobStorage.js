'use strict';

const { BlobServiceClient } = require("@azure/storage-blob");
const through2 = require('through2');

var azure = {};
azure.config = {};

class AzureBlobStorage {

  /**
   * @param {object} options - A hash of options.
   * @param {logger} logger instance to use.
   */

  constructor(options, logger) {
    const connectionString = `DefaultEndpointsProtocol=https;AccountName=${options.storageAccount};AccountKey=${options.azureKey};EndpointSuffix=${options.azureEndPointSuffix}`;
    this.blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    this.containerClient = this.blobServiceClient.getContainerClient(options.azureContainer);
    this.logger = logger || console;
  }

  /**
   * Create a writeable stream to which we can write file data.
   *
   * @param {string} assetName - The name of the asset that needs to be written.
   * @param {function} done - Callback.
   * @return {object} - The writeable stream to store the data.
   */
  createWriteStream(assetName, done) {
    const writeStream = through2();
    const blockBlobClient = this.containerClient.getBlockBlobClient(assetName);
    (async () => {
      try {
        const ONE_MEGABYTE = 1024 * 1024;
        const uploadOptions = { bufferSize: 4 * ONE_MEGABYTE, maxConcurrency: 20 };

        await blockBlobClient.uploadStream(writeStream, uploadOptions.bufferSize, uploadOptions.maxConcurrency);
        
        writeStream.emit("close");
        if (done) done();
      } catch (error) {
        this.logger.error(`Azure Blob upload failure for asset: ${assetName}`, error);
        writeStream.emit("error", error);
        if (done) done(error);
      }
    })();
    return writeStream;
  }

  /**
   * Create a readable stream to which we can read file data.
   *
   * @param {string} assetName - The name of the asset that needs to be read.
   * @return {object} - The readable stream to store the data.
   */
  createReadStream(assetName, done) {
    const passThrough = through2();
    const blockBlobClient = this.containerClient.getBlockBlobClient(assetName);

    (async () => {
      try {
        const downloadResponse = await blockBlobClient.download();
        const readableStream = downloadResponse.readableStreamBody;

        readableStream
          .on("end", () => {
            passThrough.emit("close");
            if (done) done();
          })
          .on("error", (err) => {
            this.logger.error(`Azure Blob download failure for asset: ${assetName}`, err);
            passThrough.emit("error", err);
            if (done) done(err);
          })
          .pipe(passThrough);
      } catch (error) {
        this.logger.error(`Azure Blob download failure for asset: ${assetName}`, error);
        passThrough.emit("error", error);
        if (done) done(error);
      }
    })();

    return passThrough;
  }

  async deleteFile(assetName, done) {
    try {
      const blockBlobClient = this.containerClient.getBlockBlobClient(assetName);
      const response = await blockBlobClient.deleteIfExists();

      if (response.succeeded) {
        this.logger.info(`Deleted Azure Blob asset: ${assetName}`);
        if (done) done();
      } else {
        const message = `Asset not found or already deleted: ${assetName}`;
        this.logger.warn(message);
        if (done) done();
      }
    } catch (error) {
      this.logger.error(`Azure Blob delete failure for asset: ${assetName}`, error);
      if (done) done(error);
    }
  }
}

module.exports = AzureBlobStorage;
