'use strict';

var level = require('level');
var through2 = require('through2');

class LevelStore {
  constructor(options) {
    options = options || {};
    if (!options.databaseDataDirectory) {
      throw new Error('No database path set');
    }
    var levelOptions = {
      valueEncoding: 'json',
    };
    if (options.levelDB) {
      levelOptions.db = options.levelDB;
    }
    this.db = level(options.databaseDataDirectory, levelOptions);
    this.createBucket = this.createBucket.bind(this);
    this.createBucketToken = this.createBucketToken.bind(this);
    this.listBuckets = this.listBuckets.bind(this);
    this.listBucketTokens = this.listBucketTokens.bind(this);
  }

  createBucket(bucket, data, done) {
    this.db.put('bucket!!' + bucket, data, done);
  }

  createBucketToken(bucket, token, done) {
    this.db.batch()
      .put('bucket-token!!' + bucket + '!!' + token, Date.now(), {valueEncoding: 'text'})
      .put('token!!' + token, bucket, {valueEncoding: 'text'})
      .write(done);
  }

  /**
   * @param {string} bucket - The id of the bucket.
   * @param {string} assetName - The filename associated with a given asset.
   * @param {string} assetId - The assetId.
   * @param {obj} metadata - metadata to be inserted.
   * @param {function} done - callback.
   * Create necessary keys and associated data for an new bucket asset.
   */
  createAsset(bucket, assetName, assetId, metadata, done) {
    this.db.batch()
      .put(`bucket-asset-version!!${bucket}!!${assetName}!!${assetId}`, metadata)
      .put(`asset!!${assetId}`, metadata)
      .put(`bucket-asset!!${bucket}!!${assetName}`, assetId)
      .write(done);
  }

  getBucketFromToken(token, done) {
    this.db.get('token!!' + token, {valueEncoding: 'text'}, done);
  }

  /**
   * @param {string} assetId - The assetId
   * @param {string} assetName - The filename associated with a given asset.
   * @param {function} done - callback.
   * Updates an asset adding the filename to the asset metadata.
   *
   * TODO Can be removed after the migrating data to the new key format.
   */
  addAssetNameToAssetMetadata(assetId, assetName, done) {
    var self = this;
    this.getAssetMetadata(assetId, function(err, data) {
      if (err) {
        done(err);
      }
      data.fileName = assetName;
      self.db.put(`asset!!${assetId}`, data, done);
    });
  }

  /**
   * @param {string} bucketId - The id of the bucket.
   * @param {string} assetId - The assetId.
   * @param {string} assetName - The filename associated with a given asset.
   * @param {obj} data - metadata to be inserted.
   * @param {function} done - callback.
   * Creates an asset version key with metadata.
   *
   * TODO Can be removed after the migrating data to the new key format.
   */
  createBucketAssetVersion(bucketId, assetId, assetName, data, done) {
    this.db.put(`bucket-asset-version!!${bucketId}!!${assetName}!!${assetId}`, data, done);
  }

  /**
   * @param {string} bucketId - The id of the bucket.
   * @param {string} assetName - The filename associated with a given asset.
   * @param {obj} data - metadata to be inserted.
   * @param {function} done - callback.
   * Creates an asset associated with a given bucket.
   *
   * TODO Can be removed after the migrating data to the new key format.
   */
  createBucketAsset(bucketId, assetName, data, done) {
    this.db.put(`bucket-asset!!${bucketId}!!${assetName}`, data, done);
  }

  /**
   * @param {string} bucket - The id of the bucket.
   * @param {string} assetName - The filename associated with a given asset.
   * @param {function} done - callback.
   * Gets an asset using the old style keys.
   *
   * TODO Can be removed after the migrating data to the new key format.
   */
  getOldAssetId(bucket, assetName, done) {
    this.db.get(`bucket!!${bucket}!!asset!!${assetName}`, done);
  }

  getAssetId(bucket, assetName, done) {
    this.db.get(`bucket-asset!!${bucket}!!${assetName}`, done);
  }

  getAssetMetadata(assetId, done) {
    this.db.get(`asset!!${assetId}`, done);
  }

  /**
   * @param {string} bucketId - Id of the bucket the asset resides in.
   * @param {string} assetName - name of the file asset.
   * @param {function} done - callback.
   *
   * Get asset metadata for an asset based on the filename and the bucket id.
   */
  getBucketAssetMetadata(bucketId, assetName, done) {
    var self = this;
    this.getAssetId(bucketId, assetName, function(err, value) {
      self.getAssetMetadata(value, done);
    });
  }

  getBucketAssetVersion(bucketId, assetName, assetId, done) {
    this.db.get(`bucket-asset-version!!${bucketId}!!${assetName}}!!${assetId}`, done);
  }

  /**
   * @param {string} assetId - The id of the asset.
   * @param {function} done - callback.
   * Given an assetId find the assocaited bucketId.
   *
   * TODO Can be removed after the migrating data to the new key format.
   */
  getBucketByAssetId(assetId, done) {
    var self = this;
    this.getAssetMetadata(assetId, function(err, value) {
      self.getBucketFromToken(value.token, done);
    });
  }

  updateAsset() {
    // this will call the createAsset method which upserts the asset
    this.createAsset.apply(this, arguments);
  }

  deleteBucketToken(bucket, token, done) {
    this.db.batch()
      .del('bucket-token!!' + bucket + '!!' + token)
      .del('token!!' + token)
      .write(done);
  }

  deleteBucketAsset(bucketId, assetName, done) {
    var self = this;
    this.getAssetId(bucketId, assetName, function(err, assetId) {
      self.db.batch()
        .del(`bucket-asset!!${bucketId}!!${assetName}`)
        .del(`bucket-asset-version!!${bucketId}!!${assetName}!!${assetId}`)
        .del(`asset!!${assetId}`)
        .write(done(err, assetId));
    });
  }

  /**
  * @return {object} - A JSON stream of existing buckets.
  */
  listBuckets() {
    var stream = this.db.createReadStream({
      gt: 'bucket!!!',
      lt: 'bucket!!~',
    });
    // Format the data nicely for our interface.
    var transform = through2.obj(function(data, enc, cb) {
      data = {
        bucket: data.key.substr(8),
        data: data.value,
      };
      this.push(data);
      cb();
    });
    stream.pipe(transform);
    return transform;
  }

  /**
   * @return {object} - A JSON stream of existing assets.
   *
   * TODO Can be removed after the migrating data to the new key format.
   */
  listAssets() {
    var stream = this.db.createReadStream({
      gt: 'asset!!!',
      lt: 'asset!!~',
    });
    // Format the data nicely for our interface.
    var transform = through2.obj(function(data, enc, cb) {
      data = {
        assetId: data.key.substr(7),
        metadata: data.value,
      };
      this.push(data);
      cb();
    });
    stream.pipe(transform);
    return transform;
  }

  /**
   * @param {string} bucketId - The id of the bucket.
   * @return {object} A stream of bucket assets.
   * List all assets associated with a given bucket. This is used during the
   * migration to find assets that need to be re-keyed.
   *
   * TODO Can be removed after the migrating data to the new key format.
   */
  listOldBucketsAssets(bucketId) {
    var stream = this.db.createReadStream({
      gt: 'bucket!!' + bucketId + '!!!',
      lt: 'bucket!!' + bucketId + '!!~',
    });
    // Format the data nicely for our interface.
    var transform = through2.obj(function(data, enc, cb) {
      data = {
        key: data.key,
        value: data.value,
      };
      this.push(data);
      cb();
    });
    stream.pipe(transform);
    return transform;
  }

  /**
   * @param {string} bucketId - The id of the bucket.
   * @return {object} A stream of metadata for all assets in the bucket.
   * List metadata for all assets associated with a given bucket.
   */
  listAssetMetadataByBucket(bucketId) {
    var self = this;
    var stream = this.db.createReadStream({
      gt: 'bucket-asset!!' + bucketId + '!!!',
      lt: 'bucket-asset!!' + bucketId + '!!~',
    });
    // Format the data nicely for our interface.
    var transform = through2.obj(function(data, enc, cb) {
      var transformation = this;
      self.getAssetMetadata(data.value, function(err, metadata) {
        transformation.push(metadata);
        cb(err);
      });
    });

    stream.pipe(transform);
    return transform;
  }

  /**
   * @param {string} bucket - The name of the bucket to get tokens for.
   * @return {object} - A JSON stream of existing buckets.
   */
  listBucketTokens(bucket) {
    var prefix = 'bucket-token!!' + bucket + '!!';
    var stream = this.db.createKeyStream({
      gt: prefix + '!',
      lt: prefix + '~',
    });
    // Format the data nicely for our interface.
    var transform = through2.obj(function(data, enc, cb) {
      this.push(data.substr(prefix.length));
      cb();
    });
    stream.pipe(transform);
    return transform;
  }

  getBucket(bucket, done) {
    this.db.get('bucket!!' + bucket, done);
  }

  /**
   * @param {string} bucketId - bucketId
   * @param {string} assetId - assetId
   * @param {string} assetName - Asset name associated with the assetId.
   * @param {function} done - callback
   * Removes the old format of bucket asset version as part of the migration.
   *
   * TODO Can be removed after the migrating data to the new key format.
   */
  deleteOldBucketVersion(bucketId, assetId, assetName, done) {
    this.db.del(`bucket!!${bucketId}!!${assetName}!!${assetId}`, done);
  }

  /**
   * @param {string} bucketId - bucketId
   * @param {string} assetName - Asset name associated with the assetId.
   * @param {function} done - callback
   * Removes the old format of bucket asset as part of the migration.
   *
   * TODO Can be removed after the migrating data to the new key format.
   */
  deleteOldBucketAsset(bucketId, assetName, done) {
    this.db.del(`bucket!!${bucketId}!!asset!!${assetName}`, done);
  }
}

module.exports = LevelStore;
