var fs         = require('fs');
var path       = require('path')
var util       = require('util');
var Mincer     = require('mincer');

// Streams

var MincerHtml = require('./mincer-html');

module.exports = MincerBuild;

// MincerBuid stream
//
// 1. Figure out the assets
// 2. Pass each asset through mincer, with --output option set (manifest generation)
// 3. Pass each mincer asset in the manifest.json file through mincer-sourcemap
// 4. Replace each reference in input HTML to the new one

function MincerBuild(html, options) {
  options = options || {};
  options.silent = true;
  MincerHtml.apply(this, arguments);
  this.options.output = this.options.output || 'build';
  this.configure();
  process.nextTick(this.start.bind(this));
}

util.inherits(MincerBuild, MincerHtml);

// Configures mincer environment
//
// XXX read from .mincerrc
MincerBuild.prototype.configure = function configure() {
  this.environment = new Mincer.Environment(this.dirname);

  // mincer logger
  Mincer.logger.use(this);

  // configure paths
  var includes = this.options.includes || this.options.include || [];
  includes.forEach(this.environment.appendPath, this.environment);
  this.environment.appendPath('./');

  // manifest
  this.manifest = new Mincer.Manifest(this.environment, this.options.output);

  return this;
};

// Start the build process
MincerBuild.prototype.start = function start() {
  this.log('... Start build ...');
  var steps = ['compile', 'report', 'replace']

  // XXX put as helper method
  var self = this;
  (function next(step, err) {
    if(!step) return self.emit('end');
    if(err) return self.emit('error', err);
    var method = self[step];
    method.call(self, next.bind(null, steps.shift()));
  })(steps.shift());
  return this;
};

MincerBuild.prototype.compile = function compile(done) {
  this.log('... Compiling %d assets ...', this.assets.length);
  var self = this;
  this.manifest.compile(this.normalize(this.assets));
  done();
  return this;
};

// Normalize asset path
//
// - Replace first leading `/` to be relative `./` to the input html file
// - ...
//
// Returns a new Array of normalized path.
MincerBuild.prototype.normalize = function normalize(filepaths) {
  var str = typeof filepaths === 'string';
  if(str) filepaths = filepaths.split(' ');

  var res = filepaths.map(function(filepath) {
    return filepath.replace(/^\//, '');
  }, this);

  return str ? res.join(' ') : res;
};

MincerBuild.prototype.replace = function replace(done) {
  this.log('... Replacing original reference in HTML ...');

  var self = this;
  var assets = this.assets;
  var compiled = this.manifest.assets;
  var output = this.options.output;

  var body = this.body;
  assets.forEach(function(asset) {
    body = body.replace(asset, function() {
      var filepath = compiled[self.normalize(asset)];
      return filepath ? path.join(output, filepath) : asset;
    });
  });

  this.body = body;
  done();
  return this;
};

MincerBuild.prototype.report = function report(done) {
  this.log('... Manifest: %s ...', this.manifest.path);
  if(this.options.debug) this.log().inspect(this.manifest.data.assets);
  done();
  return this;
};
