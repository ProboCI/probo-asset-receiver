var express = require('express'),
    bunyan = require('bunyan')
    bunyanExpress = require('express-bunyan-logger')
    fs = require('fs')
    Asset = require('./Asset')
;
    

var Server = function(options) {
  var options = options || {};
  this.config = options;
  this.config.port = options.port || 3000;
  this.setup = this.setup.bind(this);
  this.start = this.start.bind(this);
  this.setup();
};

Server.prototype.setup = function() {
  var express = require('express');
  var app = express();
  app.use(bunyanExpress());
  app.use(bunyanExpress.errorLogger());

  app.get('/', function (req, res) {
    res.send('Hello World');
  })

  this.app = app;
   
};

Server.prototype.start = function(done) {
  this.app.listen(3000)
};

module.exports = Server;
