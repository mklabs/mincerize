
var express = require('express');
var Mincer  = require('mincer');
var tinylr  = require('tiny-lr');
var gaze    = require('gaze');
var body    = require('body-parser');
var path    = require('path');

console.log(process.env.DEBUG, typeof process.env.DEBUG);
process.env.DEBUG = typeof process.env.DEBUG != 'undefined' ? process.env.DEBUG : 'mincerize';
var debug   = require('debug')('mincerize');

// Mincer environment
var environment = require('./environment');

// Express application
var app = express();

app
  .use('/assets/', Mincer.createServer(environment))
  .use(express.static(path.resolve('./')))
  .use(tinylr.middleware({ app: app }))

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

// And listen

app.listen(process.env.PORT || 3000, function (err) {
  if (err) {
    debug("Failed start server: " + (err.message || err.toString()));
    process.exit(128);
  }

  debug('Listening on localhost:3000');
});
