var fs        = require('fs');
var path      = require('path');
var util      = require('util');
var stream    = require('stream');
var esprima   = require('esprima');
var escodegen = require('escodegen');
var esmangle  = require('esmangle');


module.exports = minmap;
minmap.MinmapStream = MinmapStream;

// `minmap()` is the basic wrapper to MinmapStream, taking a raw String of JS
// as input and outputs the according minified version with sourcemap.
//
// Returns a MinmapStream instance.
function minmap(str, options) {
  return new MinmapStream(str, options);
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
  options.sourceMapPrefix = options.sourceMapPrefix || options['source-map-prefix'] || '';

  // XXX: consider checking sourceRoot, detect a relative path (and
  // prevent on URLs), if it is, defaults the sourceMapPrefix to
  // sourceMapRoot

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
    return this.emit('error', new Error(
      'Unable to determine list of assets from specified input.\n' +
      'To generate sourcemapping, we need to give UglifyJS2 a list of files to concat.\n' +
      'Make sure you have compiled through `mincer` before.\n'
    ));
  }

  process.nextTick(this.generate.bind(this));
}

util.inherits(MinmapStream, stream.Stream);

MinmapStream.prototype.prefix = function prefix(filename) {
  if(!this.options.sourceMapPrefix) return filename;
  return filename
    .replace(new RegExp('^' + this.options.sourceMapPrefix), '')
    .replace(/^\/+/, '');
};

MinmapStream.prototype.write = function write(chunk) {
  this.emit('data', chunk);
};

MinmapStream.prototype.writeBundle = function writeBundle(bundle) {
  if(!bundle) return this.emit('error', new Error('Missing bundle. Cannot write.'));
  if(!bundle.map) return this.write(bundle.code);
  var self = this;
  var options = this.options;
  var sourcemap = options.outSourceMap;
  var prefix = options.sourceMapPrefix;

  // cleanup filepaths from prefix if it is defined
  var map = JSON.parse(bundle.map);
  map.sources = map.sources.map(this.prefix, this);
  bundle.map = JSON.stringify(map);

  console.error('... Generate sourcemap to %s ...', sourcemap);
  fs.writeFile(sourcemap, bundle.map, 'utf8', function(err) {
    if(err) self.emit('error', err);
    var mappingUrl = self.prefix(sourcemap);
    bundle.code += "\n//@ sourceMappingURL=" + mappingUrl + '\n';
    self.write(bundle.code);
  });

  return this;
};

MinmapStream.prototype.generate = function generate() {
  var tree = esprima.parse(this.body, { loc: true });
  var filename = this.assets.slice(-1)[0];
  var options = {
    sourceMap: this.options.outSourceMap && filename,
    sourceMapWithCode: true,
    directive: true
  };

  if(!this.options.nocompress) {
    tree = esmangle.optimize(tree, null, {
        destructive: true,
        directive: true
    });
    tree = esmangle.mangle(tree, {
        destructive: true
    });

    options.format = {
      renumber: true,
      hexadecimal: true,
      escapeless: true,
      compact: true,
      semicolons: false,
      parentheses: false
    };
  }

  var output = escodegen.generate(tree, options);
  this.writeBundle({
    code: output.code,
    map: output.map + ''
  });

  return this;
};
