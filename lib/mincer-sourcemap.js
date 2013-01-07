var fs        = require('fs');
var path      = require('path');
var util      = require('util');
var stream    = require('stream');
var esprima   = require('esprima');
var escodegen = require('escodegen');
var esmangle  = require('esmangle');
var UglifyJS  = require('uglify-js2');

// for CSS generation of `-sass-debug-info` location in original CSS

var cssparse = require('css-parse');
var rework   = require('rework');

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
// JavaScript or CSS to parse and outputs the minified output with sourcemap
// generation if `/*** filepath ***/` are included within the file (case of
// standard mincer output)
//
// XXX: consider matching also on @sourceUrl that might appear in the input
// XXX: generate sourcemap from CSS input (use cssp as parser, or maybe
// less.parser and generate sourcemap). For now, `-sass-debug-info` statements
// are used.
//
// For JS type of input:
//
// The end of the file is also parsed looking for an input sourcemap to pass
// through uglify-js, unless `options.inSourceMap` is explicitely set
//
// The list of filepath is parsed from content, and then passed through
// uglify-js2 minification with sourcemap output.
//
// For CSS type of input:
//
// Turn the type into `.css` with `--css`, it'll then concat the files , generate
// debug-info for each selector, convert the debugging based on `--css-debug-*`
// options and output the result.
//
// There is no minification for CSS yet, untill proper V3 sourcemap generation
// is done through csso / cssp
//
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
//  - format          - Only used when using esprima / escodegen based
//                      generation. Maps the escodegen `format` options.
//  - compiler        - The compiler to use, one of `uglifyjs` or `esmangle`
//                      (default: uglifyjs). Notice uglifyjs based output is
//                      more reliable, with full support for `inSourceMap` and
//                      loc mapping.
//  - css             - When set to true, defines the type extension to `.css`
//  - cssDebugHost    - When defined, prefix filename location with this URL
//                      and use the HTTP protocol instead of `file://`
//  - cssDebugPrefix  - Only used when `cssDebugHost` is defined, acts like
//                      `sourceMapPrefix`, rewrites the debug info to remove
//                      the relevant prefix path from output. This should be
//                      relative to the defined host.
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

  options.cssDebugPrefix = options.cssDebugPrefix || options['css-debug-prefix'] || '';
  options.cssDebugHost = options.cssDebugHost || options['css-debug-host'] || '';

  // determine type of input, JS or CSS (defaults to CSS)
  //
  // XXX defaults based on stream input, should detect CSS from content

  options.type = options.type || '.js';
  if(options.css) options.type = '.css';
  if(options.js) options.type = '.js';

  // defaults and fallback the prefix when in css mode
  // and cleanup host from protocol, is concat'd twice otherwise

  if(options.type === '.css' && options.cssDebugPrefix) options.sourceMapPrefix = options.cssDebugPrefix;
  options.cssDebugHost = options.cssDebugHost.replace(/^https?\:\/\//, '');

  // format, depends on compression option (only relevant to esmangle)
  if(!options.format) options.format = this.options.nocompress ? {} : {
    renumber: true,
    hexadecimal: true,
    escapeless: true,
    compact: true,
    semicolons: false,
    parentheses: false
  };

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
    console.error('... No sourcemap option defined. Will default sourcemap to %s ...', options.outSourceMap);
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
    console.error('... Found sourceMappingURL in input stream. Setting UglifyJS2 option to %s ...', sourcemap);
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

  console.error('... Generate sourcemap to %s ...', sourcemap);
  fs.writeFile(sourcemap, bundle.map, 'utf8', function(err) {
    if(err) self.emit('error', err);
    // always assume we generate relative to the input file
    var mappingUrl = path.basename(self.prefix(sourcemap));
    bundle.code += "\n//@ sourceMappingURL=" + mappingUrl + '\n';
    self.write(bundle.code);
    self.emit('end');
  });

  return this;
};

// Simple facade to the relevant compiler (currently supports uglify-js2 and
// esprima / escodegen / esmangle based generation, but notice escodegen outputs
// has some issue setting up breakpoints - but filemapping is ok)
//
// Returns the minmap stream instance.
MinmapStream.prototype.generate = function generate() {
  if(this.assets.length) console.error('... Generate sourcemap from the following files ...');
  this.assets.forEach(function(asset) {
    console.error('... %s ...', asset);
  });

  if(!this.assets.length) {
    this.write(this.body);
    this.emit('end');
    return;
  }

  if(this.options.type === '.css') return this.css();
  if(this.options.compiler === 'esmangle') return this.esprima();
  return this.uglify();
};

// CSS generation, goes through each assets, render through `rework` with
// debug-info, and write to the stream for each compiled chunk of CSS.
MinmapStream.prototype.css = function css() {
  var files = [];
  var self = this;

  this.each(this.assets, function(asset, next) {
    if(!next) return files.forEach(function(file) {
      this.write(file.code);
      this.write('\n');
      this.emit('end');
    }, this);

    fs.readFile(asset, 'utf8', function(err, body) {
      if(err) return next(err);
      self.rework(asset, body, function(err, file) {
        if(err) return next(err);
        files.push(file);
        next();
      });
    });
  });

  return this;
};

// Helper to return the String of -sass-debug-info according to `filename` and
// `line`.
//
// This optionaly rewrite stuff like the filename (to be relative to an URL for
// instance instead of absolute filename) and the the -$engine-debug-info
MinmapStream.prototype.debugInfo = function debugInfo(filename, line) {
  var tpl = '@media -sass-debug-info{filename{font-family:%s}line{font-family:\\00003%d}}';
  return util.format(tpl, this.debugInfoFilename(filename), line);
};

MinmapStream.prototype.debugInfoFilename = function debugInfo(filename, line) {
  var host = this.options.cssDebugHost;
  filename = host ?
    'http://' + path.join(host, this.prefix(filename)) :
    'file://' + fs.realpathSync(filename);

  if(!host) filename = filename.replace(/[\/:.]/g, '\\$&');
  return filename;
};


// rework based, XXX switch to css-parse, css-stringify
MinmapStream.prototype.rework = function _rework(filename, body, done) {
  var style = rework(body);
  var self = this;

  var lines = body.split('\n');

  var infos = [];
  style.use(function(style, rework) {
    var rules = [];
    style.rules.forEach(function(rule) {
      var last = rules.slice(-1)[0];
      if(rule.media) {
        rules.push(rule);
        return;
      }

      // has already map info, do nothing for now
      if(last && /-[\w]+-debug-info/.test(last.media)) {
        rules.push(rule);
        return;
      }

      infos.push({
        filename: filename,
        selector: (rule.selectors || []).join(' ')
      });

      rules.push(rule);
    });

    style.rules = rules;
  });

  var newlines = [];
  var reg = /-[\w]+-debug-info/;
  var last;
  lines.forEach(function(line, i) {
    var last = newlines.slice(-1)[0];
    if(reg.test(line)) {
      newlines.push(line);
      return;
    }

    // has already map info, do nothing for now
    if(last && reg.test(last)) {
      newlines.push(line);
      return;
    }

    var info = infos.filter(function(info) {
      if(!line) return false;
      if(!info.selector) return false;

      // to be fleshed out, possible reliable way
      // parse the line through css-parse check selector
      return ~line.indexOf(info.selector);
    })[0];

    if(!info) {
      newlines.push(line);
      return;
    }

    newlines.push(this.debugInfo(filename, i + 1));
    newlines.push(line);
  }, this);

  done(null, {
    filename: filename,
    code: newlines.join('\n')
  });
};

// Each async helper
MinmapStream.prototype.each = function each(array, fn) {
  var self = this;
  if(typeof array === 'string') array = array.split(' ');
  array = Array.isArray(array) ? array : [array];
  fn = (fn || function() {}).bind(this);
  (function next(item, err) {
    if(!item) return fn();
    if(err) return self.emit('error', err);
    fn(item, next.bind(null, array.shift()));
  })(array.shift());
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

  var ast = null;
  files.forEach(function(file) {
    var code = fs.readFileSync(file, "utf8");
    ast = UglifyJS.parse(code, {
      filename: file,
      toplevel: ast
    });
  }, this);

  if(!ast) ast = UglifyJS.parse(this.body, {
    filename: options.outSourceMap.replace(/\.map$/, '.js')
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

// Esprima / Escodegen / Esmangle based generation. **experimental**
//
// Based off https://gist.github.com/4230837
//
// XXX: Sourcemap Generation OK untill trying to set breakpoint.
//
// Returns the minmap stream instance.
MinmapStream.prototype.esprima = function _esprima() {
  var filename = this.assets.slice(-1)[0];
  var separator = this.options.nocompress ? '\n' : ';';
  var sourceRoot = this.options.sourceRoot;

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
//
// Takes a `filename` and `content` of JS, generate the esprima tree, optimize
// & mangle if in compress mode, generates through `escodegen` and returns the
// bundle pair of code / map string output.
//
// Returns the pair of `code` / `map` from `escodegen`
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
