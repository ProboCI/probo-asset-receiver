var level = require('level'),
    through2 = require('through2')
;

var LevelStore = function(options) {
  if (!options.databaseDataDirectory) throw Error ('No database path set');
  this.db = level(options.databaseDataDirectory, { valueEncoding: 'json' });
  this.createBucket = this.createBucket.bind(this);
  this.createBucketToken = this.createBucketToken.bind(this);
  this.listBuckets = this.listBuckets.bind(this);
};

LevelStore.prototype.createBucket = function(bucket, data, done) {
  this.db.put('bucket!!' + bucket, data, done);
};

LevelStore.prototype.createBucketToken = function(bucket, token, done) {
  this.db.batch()
    .put('bucket!!' + bucket + '!!' + token, Date.now())
    .put('token!!' + token, bucket)
    .write(done);
}

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
