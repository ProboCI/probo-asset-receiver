var express = require('express'),
    bunyanExpress = require('express-bunyan-logger')
    fs = require('fs')
    Asset = require('./Asset')
;
    

var Server = function(options) {
  var options = options || {};
  this.options = options;
  this.logger = options.logger;

  this.setup = this.setup.bind(this);
  this.start = this.start.bind(this);

  this.setup();
};

Server.prototype.setup = function() {
  var express = require('express');
  var app = express();
  var loggerOptions = {
    logger: this.options.logger,
  };
  app.use(bunyanExpress(loggerOptions));
  app.use(bunyanExpress.errorLogger(loggerOptions));

  app.get('/', function (req, res) {
    res.send('');
  });

  app.post('/buckets/:name', function(req, res) {
    var name = name
    res.send(req.params);
  });


  this.app = app;
   
};

Server.prototype.start = function(done) {
  this.app.listen(this.options.port, this.options.host, function(error) {
    if (done) {
      done(error);
    }
  });
};

module.exports = Server;
