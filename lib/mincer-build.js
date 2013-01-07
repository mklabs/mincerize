var fs         = require('fs');
var path       = require('path')
var util       = require('util');
var Mincer     = require('mincer');

// Streams

var MincerHtml      = require('./mincer-html');
var MincerSourcemap = require('./mincer-sourcemap');

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
  if(!includes.length) includes.push(this.dirname);
  includes.forEach(this.environment.appendPath, this.environment);

  // manifest
  this.manifest = new Mincer.Manifest(this.environment, this.options.output);

  return this;
};

// Start the build process
MincerBuild.prototype.start = function start() {
  this.log('... Start build ...');
  var steps = ['compile', 'report', 'sourcemap', 'replace']

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
  this.manifest.compile(this.normalize(this.assets), done);
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

MincerBuild.prototype.sourcemap = function sourcemap(done) {
  var assets = this.manifest.data.assets;
  var files = Object.keys(assets);
  var revved = Object.keys(assets).map(function(asset) {
    return assets[asset];
  });

  var self = this;
  (function next(file, err) {
    if(!file) return done();
    if(err) return done(err);
    self.sourcemapCompile(file, next.bind(null, revved.shift()));
  })(revved.shift());

  return this;
};

// XXX duplexify streams, should be able to pipe a readable stream
MincerBuild.prototype.sourcemapCompile = function(file, done) {
  this.log('... Compile sourcemap for %s ...', file);
  var self = this;
  var dir = this.manifest.dir;
  fs.readFile(path.join(dir, file), 'utf8', function(err, body) {
    if(err) return done(err);

    // XXX hoist up options from sourcemap program
    var sourcemap = new MincerSourcemap(body, {
      type: path.extname(file),
      sourcemap: path.join(self.options.output, file + '.map'),
      prefix: process.cwd(),
      sourceRoot: '/',
      // cssDebugHost: '/'
    });

    sourcemap.assets = sourcemap.assets.map(function(asset) {
      var bundle = self.environment.findAsset(asset);
      return bundle.pathname;
    });

    self.log('... Replacing %s original content with sourcemap info...', path.join(dir, file));
    sourcemap.pipe(fs.createWriteStream(path.join(dir, file)));
    sourcemap.once('end', done);
  });
  return this;
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

  this.write(body);
  done();
  return this;
};

MincerBuild.prototype.report = function report(done) {
  this.log('... Manifest: %s ...', this.manifest.path);
  if(this.options.debug) this.log().inspect(this.manifest.data.assets);
  done();
  return this;
};

