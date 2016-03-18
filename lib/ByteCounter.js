'use strict';

var Transform = require('stream').Transform;
var util = require('util');

util.inherits(ByteCounter, Transform);

function ByteCounter(options) {
  Transform.call(this, options);
  this.bytes = 0;
}

ByteCounter.prototype._transform = function(chunk, enc, cb) {
  this.bytes += chunk.length;
  this.push(chunk);
  cb();
};

module.exports = ByteCounter;
