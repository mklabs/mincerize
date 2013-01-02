var fs = require('fs');
var path = require('path');
var util = require('util');
var stream = require('stream');
var UglifyJS = require('uglify-js2');

module.exports = minmap;
minmap.MinmapStream = MinmapStream;

// `minmap()` is the basic wrapper to MinmapStream, taking a raw String of JS
// as input and outputs the according minified version with sourcemap.
//
// Returns a MinmapStream instance.
function minmap(str, options) {
  var stream = new MinmapStream(str, options);
  process.nextTick(function() {
    stream.write('tadam');
  });
  return stream;
}

// The `MinmapStream` object is a writable stream, that takes the raw body of
// JavaScript to parse and outputs the minified output with sourcemap
// generation if `/*** filepath ***/` are included within the file (case of
// standard mincer output)
//
// The list of filepath is parsed from content, and then passed through
// uglify-js2 minification with sourcemap output.
function MinmapStream(str, options) {
  this.readable = true;
  this.writable = true;
  stream.Stream.call(this);

  options = this.options = options || {};
  options.sourceRoot   = options.sourceRoot || options['source-map-root'] || '';
  options.inSourceMap  = options.inSourceMap || options['in-source-map'] || '';
  options.outSourceMap = options.outSourceMap || options['source-map'] || '';

  this.body = str || '';
  this.matcher = /\s*\/\*{3}\s*([^\s]+)\s*\*{3}\//;
  this.lines = this.body.split('\n');
  this.assets = this.lines
    .filter(function(line) {
      return this.matcher.test(line);
    }, this)
    .map(function(line) {
      var matches = line.match(this.matcher);
      var asset = matches[1];
      return path.extname(asset) ? asset : asset + '.js';
    }, this);

  if(!this.assets.length) {
    return this.emit('error', new Error('Unable to determine list of assets from specified input. To generate sourcemapping, we need to give UglifyJS2 a list of files to concat.'));
  }

  process.nextTick(this.minify.bind(this));
}

util.inherits(MinmapStream, stream.Stream);

MinmapStream.prototype.write = function write(chunk) {
  this.emit('data', chunk);
};

MinmapStream.prototype.minify = function minify() {
  console.error('... Generate sourcemap from the following files ...');
  this.assets.forEach(function(asset) {
    console.error('... %s ...', asset);
  });
  var bundle = UglifyJS.minify(this.assets, this.options);
  if(!bundle.map) return this.write(bundle.code);

  var self = this;
  var sourcemap = this.options.outSourceMap;

  fs.writeFile(sourcemap, bundle.map, 'utf8', function(err) {
    if(err) self.emit('error', err);
    bundle.code += "\n//@ sourceMappingURL=" + sourcemap;
    self.write(bundle.code);
  });
};
