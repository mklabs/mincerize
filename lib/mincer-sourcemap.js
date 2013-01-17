var fs        = require('fs');
var path      = require('path');
var util      = require('util');
var stream    = require('stream');
var UglifyJS  = require('uglify-js2');
var debug     = require('debug')('mincer-sourcemap:sourcemap');

module.exports = minmap;
minmap.MinmapStream = MinmapStream;

// `minmap()` is the basic wrapper to MinmapStream, taking a raw String of JS
// as input and outputs the according minified version with sourcemap.
//
// Examples
//
//    minmap('var str = "of js";', opts).pipe(process.stdout);
//
// Returns a MinmapStream instance.
function minmap(str, options) {
  return new MinmapStream(str, options);
}

// The `MinmapStream` object is a writable stream, that takes the raw body of
// JavaScript to parse and outputs the minified output with sourcemap
// generation if `/*** filepath ***/` are included within the file (case of
// standard mincer output with LineComments post processor)
//
// The end of the file is also parsed looking for an input sourcemap to pass
// through uglify-js, unless `options.inSourceMap` is explicitely set
//
// The list of filepath is parsed from content, and then passed through
// uglify-js2 minification with sourcemap output.
//
// - str              - The String of JavaScript to parse and generate from
// - options          - A hash of options with the following properties:
//  - js              - When set to true, defines the type extension to `.js`
//  - nocompress      - When set to true, this prevents the minification process
//  - sourceRoot      - The `sourceRoot` option to generate the sourcemap with
//  - inSourceMap     - The initial sourcemap to consider for generating the
//                      new one. When omited, the actual `str` content is
//                      parsed for an existing `sourceMappingURL`.
//  - outSourceMap    - The sourcemap output to generate and write to file
//                      system
//  - sourceMapPrefix - When defined, every `sources` filepath in the resulting
//                      sourcemap is rewritten to remove this prefix value.
//                      Also used to figure out the original `inSourceMap` when
//                      parsed from input and `sourceMappingURL` end of file.
//
function MinmapStream(str, options) {
  this.readable = true;
  this.writable = true;
  stream.Stream.call(this);

  options = this.options = options || {};
  options.sourceRoot   = options.sourceRoot || options['source-map-root'] || '';
  options.inSourceMap  = options.inSourceMap || options['in-source-map'] || '';
  options.outSourceMap = options.outSourceMap || options.sourcemap || options['source-map'] || '';
  options.sourceMapPrefix = options.sourceMapPrefix || options.prefix || options['source-map-prefix'] || '';
  options.type = options.type || '.js';

  this.body = str || '';
  this.matcher = /\s*\/\*{3}\s+([^\s]+)\s+\*{3}\//;
  this.lines = this.body.trim().split('\n');
  this.assets = this.lines
    .filter(function(line) {
      return this.matcher.test(line);
    }, this)
    .map(function(line) {
      var matches = line.match(this.matcher);
      var asset = matches[1];
      var ext = path.extname(asset);
      if(ext === '.js') return asset;
      if(ext === '.cs') return asset;
      return asset + this.options.type;
    }, this);

  // defaults sourcemap to last parsed bundle
  if(options.type === '.js' && !options.outSourceMap) {
    if(this.assets.length) {
      options.outSourceMap = this.assets.slice(-1)[0];
      options.outSourceMap = options.outSourceMap.replace(path.extname(options.outSourceMap), '.map');
    } else {
      options.outSourceMap = 'mincer.map';
    }
    debug('... No sourcemap option defined. Will default sourcemap to %s ...', options.outSourceMap);
  }


  this.readInSourceMap();

  process.nextTick(this.generate.bind(this));
}

util.inherits(MinmapStream, stream.Stream);

// Uses `options.sourceMapPrefix` if defined to replace the first part of `filename`
MinmapStream.prototype.prefix = function prefix(filename) {
  if(!this.options.sourceMapPrefix) return filename;
  var parts = this.options.sourceMapPrefix.split(':');
  var replacement = parts[1] || '';
  return filename
    .replace(new RegExp('^' + parts[0]), parts[1] || '')
    .replace(/^\/+/, '');
};

// Emits `data` event with `chunk` of data
MinmapStream.prototype.write = function write(chunk) {
  this.emit('data', chunk);
};

// Check input file for existing sourcemap, only if user didn't explicitely
// defined one.
//
// The file is read in reverse order, parsing the end of the file first.
//
// XXX: consider tweaking the regex to also catch CSS type of sourceMappingURL
//
// Whenever a `sourceMappingURL` line is found, the stream instance
// `options.inSourceMap` is updated with this value.
//
// Returns the minmap stream instance.
MinmapStream.prototype.readInSourceMap = function() {
  if(this.options.inSourceMap) return this;
  var lines = this.lines.slice(0).reverse();
  var pattern = /^\/\/\s*@\s*sourceMappingURL\s*=\s*(.+)/;
  var line, sourcemap;
  while (!sourcemap && lines.length) {
    line = lines.pop();
    sourcemap = (line.match(pattern) || [])[1];
  }

  if(sourcemap && this.options.sourceMapPrefix) {
    sourcemap = path.join(this.options.sourceMapPrefix, sourcemap);
  }

  if(sourcemap) {
    debug('... Found sourceMappingURL in input stream. Setting UglifyJS2 option to %s ...', sourcemap);
    this.options.inSourceMap = sourcemap;
  }

  return this;
};

// Writes `bundle` pair of parsed AST, with `bundle.code` and `bundle.map` as
// raw Strings.
//
// `bundle.map` is written to the file system directly based on
// `options.outSourceMap`, whereas `bundle.code` is written to the stream.
//
// Returns the minmap stream instance.
MinmapStream.prototype.writeBundle = function writeBundle(bundle) {
  if(!bundle) return this.emit('error', new Error('Missing bundle. Cannot write.'));
  if(!bundle.map) return this.write(bundle.code);
  var self = this;
  var options = this.options;
  var sourcemap = options.outSourceMap;
  var prefix = options.sourceMapPrefix;

  var map = JSON.parse(bundle.map);
  map.sources = map.sources.map(this.prefix, this);
  // cleanup filepaths from prefix if it is defined
  // XXX: should probably traverse the tree of sections for esmangle based output
  if(map.sources) map.sources = map.sources.map(this.prefix, this);
  bundle.map = JSON.stringify(map, null, 2);

  debug('... Generate sourcemap to %s ...', sourcemap);
  fs.writeFile(sourcemap, bundle.map, 'utf8', function(err) {
    if(err) self.emit('error', err);
    var mappingUrl = path.basename(self.prefix(sourcemap));
    bundle.code += "\n//@ sourceMappingURL=" + mappingUrl + '\n';
    self.write(bundle.code);
    self.emit('end');
  });

  return this;
};

// Simple facade to uglify-js2 processing. Outputs the list of assets
// path in debug mode and write the current content if no assets were
// found.
//
// Returns the minmap stream instance.
MinmapStream.prototype.generate = function generate() {
  if(this.assets.length) debug('... Generate sourcemap from the following files ...');
  this.assets.forEach(function(asset) {
    debug('... %s ...', asset);
  });

  if(!this.assets.length) {
    this.write(this.body);
    this.emit('end');
    return;
  }

  return this.uglify();
};

// UglifyJS2 based generation. Parses tree, compress & mangle if in compress
// mode, then generates the code & sourcemap output.
//
// Returns the minmap stream instance.
MinmapStream.prototype.uglify = function uglify() {
  var options = UglifyJS.defaults(this.options, {
    outSourceMap : null,
    sourceRoot   : null,
    inSourceMap  : null,
    warnings     : false
  });

  var files = this.assets;
  var filename = options.outSourceMap.replace(/\.map$/, '.js');

  var ast = null;
  files.forEach(function(file) {
    var code = fs.readFileSync(file, "utf8");
    ast = UglifyJS.parse(code, {
      filename: file,
      toplevel: ast
    });
  }, this);

  if(!ast) ast = UglifyJS.parse(this.body, {
    filename: filename
  });

  if(!this.options.nocompress) {
    ast.figure_out_scope();
    ast = ast.transform(UglifyJS.Compressor({
      warnings: options.warnings
    }));

    ast.figure_out_scope();
    ast.compute_char_frequency();
    ast.mangle_names();
  }

  var map = null;
  var inMap = null;
  if (options.inSourceMap) {
    inMap = fs.readFileSync(options.inSourceMap, "utf8");
  }

  if (options.outSourceMap) map = UglifyJS.SourceMap({
    orig: inMap,
    root: options.sourceRoot,
    file: path.basename(filename)
  });

  var stream = UglifyJS.OutputStream({
    source_map: map,
    beautify: this.options.nocompress,
    comments: this.options.nocompress
  });

  ast.print(stream);
  this.writeBundle({
    code: stream + '',
    map: map + ''
  });

  return this;
};
