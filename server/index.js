
var express = require('express');
var Mincer  = require('mincer');
var tinylr  = require('tiny-lr');
var gaze    = require('gaze');
var path    = require('path');
var debug   = require('debug')('mincerize:serve');

module.exports = function server (options) {
  // Mincer environment
  var environment = require('./environment')(options);

  // Mincer Server
  var Server = require('./server');
  var srv = new Server(environment, options);

  // Express application
  var app = express();

  app
    .use('/' + options.mount.replace(/^\//, ''), function(req, res, next) {
      return srv.handle(req, res, next);
    })
    .use(express.static(path.resolve('./')))
    .use(tinylr.middleware({ app: app }));

  if (!options.watch) return app;

  // Gaze configuration for file watching
  var watchedPaths = environment.paths.map(function(envPath) {
    return envPath + '/**/*';
  });

  debug('Monitoring changes for', watchedPaths);
  gaze(watchedPaths, function(err, watcher) {
    // On changed/added/deleted
    this.on('all', function(event, filepath) {
      debug(filepath + ' was ' + event);

      // Required to get live CSS reloading, must match the proper path (eg .css
      // instead of .css.less or .css.scss)
      filepath = filepath.replace(/\.css\.[\w\.]+$/, '.css');
      debug('Notify tinylr server for', filepath);
      tinylr.changed(filepath);
    });
  });

  return app;
}

