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

MinmapStream.prototype.write = function write(chunk) {
  this.emit('data', chunk);
};

MinmapStream.prototype.generate = function generate() {
  console.error('... Generate sourcemap from the following files ...');
  this.assets.forEach(function(asset) {
    console.error('... %s ...', asset);
  });

  if(this.options.nocompress) return this.concat();
  return this.minify();
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
    bundle.code += "\n//@ sourceMappingURL=" + mappingUrl;
    self.write(bundle.code);
  });
};

MinmapStream.prototype.minify = function minify() {
  var bundle = UglifyJS.minify(this.assets, this.options);
  if(!bundle.map) return this.write(bundle.code);
  this.writeBundle(bundle);
};

MinmapStream.prototype.concat = function concat() {
  console.error('... Concat ...');
  console.error('... sourcemap ... ', Object.keys(UglifyJS));
  var options = UglifyJS.defaults(this.options, {
    outSourceMap : null,
    sourceRoot   : null,
    inSourceMap  : null,
    warnings     : false
  });

  var files = this.assets;

  // 1. parse
  var ast = null;
  files.forEach(function(file) {
    var code = fs.readFileSync(file, "utf8");
    ast = UglifyJS.parse(code, {
      filename: file,
      toplevel: ast
    });
  });
  ast.figure_out_scope();

  // 2. compress ==> noop
  // 3. mangle ==> noop

  // 4. output
  var map = null;
  var inMap = null;
  if (options.inSourceMap) {
    inMap = fs.readFileSync(options.inSourceMap, "utf8");
  }

  if (options.outSourceMap) map = UglifyJS.SourceMap({
    orig: inMap,
    root: options.sourceRoot,
    file: options.outSourceMap
  });


  console.log(UglifyJS.OutputStream + '');
  return;

  var stream = UglifyJS.OutputStream({
    source_map: map,
    beautify: true,
    comments: true
  });
  ast.print(stream);
  var bundle = {
    code : stream + '',
    map  : map + ''
  };

  return this.writeBundle(bundle);
};

MinmapStream.prototype.prefix = function prefix(filename) {
  if(!this.options.sourceMapPrefix) return filename;
  return filename
    .replace(new RegExp('^' + this.options.sourceMapPrefix), '')
    .replace(/^\/+/, '');
};
