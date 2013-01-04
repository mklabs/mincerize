var fs        = require('fs');
var path      = require('path');
var util      = require('util');
var stream    = require('stream');
var esprima   = require('esprima');
var escodegen = require('escodegen');
var esmangle  = require('esmangle');
var UglifyJS  = require('uglify-js2');


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
// XXX: consider mathing also on @sourceUrl that might appear in the input
//
// The list of filepath is parsed from content, and then passed through
// uglify-js2 minification with sourcemap output.
//
// The end of the file is also parsed looking for an input sourcemap to pass
// through uglify-js, unless `options.inSourceMap` is explicitely set
function MinmapStream(str, options) {
  this.readable = true;
  this.writable = true;
  stream.Stream.call(this);

  options = this.options = options || {};
  options.sourceRoot   = options.sourceRoot || options['source-map-root'] || '';
  options.inSourceMap  = options.inSourceMap || options['in-source-map'] || '';
  options.outSourceMap = options.outSourceMap || options['source-map'] || '';
  options.sourceMapPrefix = options.sourceMapPrefix || options['source-map-prefix'] || '';

  // format, depends on compression option
  if(!options.format) options.format = this.options.nocompress ? {} : {
    renumber: true,
    hexadecimal: true,
    escapeless: true,
    compact: true,
    semicolons: false,
    parentheses: false
  };

  this.body = str || '';
  this.matcher = /\s*\/\*{3}\s*([^\s]+)\s*\*{3}\//;
  this.lines = this.body.trim().split('\n');
  this.assets = this.lines
    .filter(function(line) {
      return this.matcher.test(line);
    }, this)
    .map(function(line) {
      var matches = line.match(this.matcher);
      var asset = matches[1];
      return path.extname(asset) === '.js' ? asset : asset + '.js';
    }, this);

  // defaults sourcemap to last parsed bundle
  if(!options.outSourceMap) {
    if(this.assets.length) {
      options.outSourceMap = this.assets.slice(-1)[0];
      options.outSourceMap = options.outSourceMap.replace(path.extname(options.outSourceMap), '.map');
    } else {
      option.outSourceMap = 'mincer.map';
    }
    console.error('... No sourcemap option defined. Will default sourcemap to %s ...', options.outSourceMap);
  }

  // check input file for existing sourcemap, last line is parsed
  // do so only if user didn't explicitely defined one
  this.readInSourceMap();

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

// check input file for existing sourcemap, last line is parsed
// do so only if user didn't explicitely defined one
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

  if(sourcemap) this.options.inSourceMap = sourcemap;

  return this;
};

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
  if(this.assets.length) console.error('... Generate sourcemap from the following files ...');
  this.assets.forEach(function(asset) {
    console.error('... %s ...', asset);
  });

  if(this.options.compiler === 'esmangle') return this.esprima();
  return this.uglify();
};

// UglifyJS2 based generation

MinmapStream.prototype.uglify = function uglify() {
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
  }, this);

  // XXX deal with it
  if(!ast) ast = UglifyJS.parse(this.body, {
    filename: options.outSourceMap.replace(/\.map$/, '.js')
  });

  // 2. compress & mangle when in compress mode
  if(!this.options.nocompress) {
    ast.figure_out_scope();
    ast = ast.transform(UglifyJS.Compressor({
      warnings: options.warnings
    }));

    ast.figure_out_scope();
    ast.compute_char_frequency();
    ast.mangle_names();
  }

  // 3. output
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

// Esprima / Escodegen / Esmangle based generation
//
// XXX: Sourcemap Generation OK untill trying to set breakpoint.

// Based off https://gist.github.com/4230837
MinmapStream.prototype.esprima = function _esprima() {
  var filename = this.assets.slice(-1)[0];
  var separator = this.options.nocompress ? '\n' : ';';
  var sourceRoot = this.options.sourceRoot;

  // consider going full async here
  var sections = this.assets.map(function(filename) {
    var content = fs.readFileSync(filename, 'utf-8');
    return this.compile(filename, content);
  }, this);

  var code = sections.map(function(pair) {
    return pair.code;
  }).join(separator);

  // reduce the map ast to a single chunk of sections
  sections = sections.reduce(function(result, pair) {
    var chunk = pair.code;
    var section = {
      offset: {
        line: result.line,
        column: result.column
      },
      map: pair.map
    };

    if(sourceRoot && !section.map._sourceRoot) {
      section.map._sourceRoot = sourceRoot;
    }

    result.sections.push(section);

    chunk.split('').forEach(function (ch) {
      if (ch === '\n') {
        result.line += 1;
        result.column = 0;
      } else {
        result.column += 1;
      }
    });
    // concatenation semicolon or new line
    result.column += separator.length;
    return result;
  }, { line: 1, column: 0, sections: [] });

  var map = {
    version: 3,
    file: filename
  };

  if(sourceRoot) map.sourceRoot = sourceRoot;
  map.sections = sections.sections;

  this.writeBundle({
    code: code,
    map: JSON.stringify(map)
  });

  return this;
};

// Based off https://gist.github.com/4230837
MinmapStream.prototype.compile = function compile(filename, content) {
  var tree = esprima.parse(content, { loc: true });
  if(!this.options.nocompress) {
    tree = esmangle.optimize(tree, null, {
      destructive: true,
      directive: true
    });
    tree = esmangle.mangle(tree, {
      destructive: true
    });
  }
  return escodegen.generate(tree, {
    format: this.options.format,
    sourceMap: this.options.outSourceMap && filename,
    sourceMapWithCode: true,
    directive: true
  });
};
