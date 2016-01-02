'use strict';

var passport = require('passport');
var BearerStrategy = require('passport-http-bearer').Strategy;

/**
 * Function that returns an auth lib object to use as route auth middleware
 * @param {Object} config - auth config
 * @param {Array} config.tokens - Used with Bearer strategy, list of
 *                                valid tokens. If this value is not
 *                                an array, authentication is disabled!
 * @return {Object} - auth lib with the '.auth' function to use
 *                    as the auth middleware with routes
 */
module.exports = function(config) {
  var authlib = {
    verify: function(token, done) {
      process.nextTick(function() {
        var user = {
          token: token,
        };

        var found = config.tokens.indexOf(token) > -1;

        if (!found) { return done(null, false); }
        return done(null, user);
      });
    },
  };

  passport.use(new BearerStrategy({realm: 'API Key'}, function(token, done) {
    return authlib.verify(token, done);
  }));

  var tokenAuth = passport.authenticate('bearer', {session: false, failWithError: false});

  // auth middleware that only checks for token authentication if its configured
  authlib.auth = function(req, res, next) {
    if (Array.isArray(config.tokens)) {
      return tokenAuth(req, res, next);
    }
    else {
      next();
    }
  };

  return authlib;
};
