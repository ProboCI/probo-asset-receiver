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

  createAsset(bucket, assetName, assetId, metadata, done) {
    this.db.batch()
      .put('bucket!!' + bucket + '!!' + assetName + '!!' + assetId, metadata)
      .put('asset!!' + assetId, metadata)
      .put('bucket!!' + bucket + '!!asset!!' + assetName, assetId)
      .write(done);
  }
 
  getAssetId(bucket, assetName, done) {
    this.db.get('bucket!!' + bucket + '!!asset!!' + assetName, done);
  }

  deleteBucketToken(bucket, token, done) {
    this.db.batch()
      .del('bucket-token!!' + bucket + '!!' + token)
      .del('token!!' + token)
      .write(done);
  }

  getBucketFromToken(token, done) {
    this.db.get('token!!' + token, {valueEncoding: 'text'}, done);
  }

  getBucket(bucket, done) {
    this.db.get('bucket!!' + bucket, done);
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
}

module.exports = LevelStore;
