var level = require('level'),
    through2 = require('through2')
;

var LevelStore = function(options) {
  options = options || {};
  if (!options.databaseDataDirectory) throw Error ('No database path set');
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
};

LevelStore.prototype.createBucket = function(bucket, data, done) {
  this.db.put('bucket!!' + bucket, data, done);
};

LevelStore.prototype.createBucketToken = function(bucket, token, done) {
  this.db.batch()
    .put('bucket!!' + bucket + '!!' + token, Date.now(), { valueEncoding: 'text' })
    .put('token!!' + token, bucket, { valueEncoding: 'text' })
    .write(done);
};

LevelStore.prototype.createAsset = function(bucket, assetName, assetId, metadata, done) {
  this.db.batch()
    .put('bucket!!' + bucket + '!!' + assetName + '!!' + assetId, metadata)
    .put('asset!!' + assetId, metadata)
    .put('bucket!!' + bucket + '!!asset!!' + assetName, assetId)
    .write(done);
};

LevelStore.prototype.getAssetId = function(bucket, assetName, done) {
  this.db.get('bucket!!' + bucket + '!!asset!!' + assetName, done);
};

LevelStore.prototype.deleteBucketToken = function(bucket, token, done) {
  this.db.batch()
    .del('bucket!!' + bucket + '!!' + token)
    .del('token!!' + token)
    .write(done);
};

LevelStore.prototype.getBucketFromToken = function(token, done) {
  this.db.get('token!!' + token, { valueEncoding: 'text' }, done);
};

LevelStore.prototype.getBucket = function(bucket, done) {
  this.db.get('bucket!!' + bucket, done);
};

// Returns a JSON stream of existing buckets.
LevelStore.prototype.listBuckets = function() {
  var stream =  this.db.createReadStream({
    'gt': 'bucket!!!',
    'lt': 'bucket!!~',
  })
  // Format the data nicely for our interface.
  var transform = through2.obj(function(data, enc, cb) {
    var data = {
      bucket: data.key.substr(8),
      data: data.value,
    };
    this.push(data);
    cb();
  });
  stream.pipe(transform);
  return transform;
};

module.exports = LevelStore;
