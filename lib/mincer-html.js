var fs     = require('fs');
var path   = require('path');
var util   = require('util');
var Stream = require('stream').Stream;

module.exports = MincerHtml;

// Parses a chunk of HTML and returns the lisf of JS and CSS assets in the
// order they appear in the input chunk of HTML.
function MincerHtml(html, options) {
  options = this.options = options || {};
  this.body = html;
  this.tree = {};
  this.assets = [];
  this.source = options.filename || options.source || 'index.html';
  this.dirname = options.dirname || path.dirname(this.source);
  this.matchCss = options.matchCss || /\s*<link.+href="([^"]+)"/;
  this.matchJs = options.matchJs || /\s*<script.+src="([^"]+)"/;

  this.parse();
  if(!options.silent) process.nextTick(this.output.bind(this));
}

util.inherits(MincerHtml, Stream);

MincerHtml.prototype.parse = function parse(data) {
  data = data || this.body;
  var lines = data.split('\n');

  var assets = lines.filter(function(l) {
    var js = this.matchJs.test(l);
    var css = this.matchCss.test(l);
    return js || css;
  }, this).map(this.parseLine, this);

  if(this.options.ignore) assets = assets.filter(function(asset) {
    return !~asset.indexOf(this.options.ignore);
  }, this);

  this.assets = this.assets.concat(assets);

  return this;
};

MincerHtml.prototype.parseLine = function parseLine(line) {
  var filepath = (line.match(this.matchCss) || [])[1];
  if(!filepath) filepath = (line.match(this.matchJs) || [])[1];
  return filepath || '';
};

MincerHtml.prototype.output = function output() {
  var assets = this.assets;

  if(this.options.css) assets = this.filter(assets, '.css');
  if(this.options.js) assets = this.filter(assets, '.js');
  if(this.options.grep) assets = this.filter(assets, new RegExp(this.options.grep));
  if(this.options.ignore) assets = assets.filter(function(asset) {
    return !~asset.indexOf(this.options.ignore);
  }, this);

  if(this.options.bundle) return this.bundle(assets);
  if(this.options.convert) return this.convert(assets);

  assets.forEach(function(filename) {
    this.write(filename);
  }, this);
  return this;
};

MincerHtml.prototype.convert = function convert(assets) {
  assets = assets || this.assets;
  var dirname = this.dirname;

  var css = {
    file: path.join(dirname, 'manifest.css'),
    code: this.css(this.filter(assets, '.css'), true)
  };

  var js = {
    file: path.join(dirname, 'manifest.js'),
    code: this.js(this.filter(assets, '.js'), true)
  };

  // cleanup html from previous link / scripts

  var lines = this.body.split('\n');
  var body = lines.filter(function(l) {
    var js = this.matchJs.test(l);
    var css = this.matchCss.test(l);
    var asset = this.parseLine(l);
    if(!(js || css)) return true;
    return !~assets.indexOf(asset);
  }, this).join('\n');

  // reaad a single link reference to the manifest.css bundle
  body = body.replace(/(\s*)<\/head>/, function(match, indent) {
    indent = indent.replace(/\n/g, '');
    return '\n' + indent + (indent || '  ') + util.format('<link rel="stylesheet" href="%s">', css.file);
  });

  // same for js, a single script reference to the manifest.js bundle but right
  // before the body end tag
  body = body.replace(/(\s*)<\/body>/, function(match, indent) {
    indent = indent.replace(/\n/g, '');
    return '\n' + indent + (indent || '  ') + util.format('<script src="%s"></script>', js.file);
  });


  var self = this.log('... Writing CSS manifest bundle to %s ... ', css.file);
  fs.writeFile(css.file, css.code, function(err) {
    if(err) return self.emit('error', err);
    self.log('... Writing JS manifest bundle to %s ... ', js.file);
    fs.writeFile(js.file, js.code, function(err) {
      if(err) return self.emit('error', err);
      self.write(body);
    });
  });
};

MincerHtml.prototype.bundle = function bundle(assets) {
  assets = assets || this.assets;
  var css = this.filter(assets, '.css');
  var js = this.filter(assets, '.js');

  if(css.length) {
    this.css(css);
    if(js.length) this.write();
  }
  if(js.length) this.js(js);
  return this;
};

MincerHtml.prototype.css = function css(styles, resume) {
  if(typeof styles === 'string') styles = styles.split(' ');
  styles = Array.isArray(styles) ? styles : [styles];
  if(resume) this.pause();
  this.write('/** Generated CSS bundle ' + new Date() + '**/');
  this.write();
  this.write('/*');
  this.write();
  styles.forEach(function(file) {
    this.write('= require ' + file);
  }, this);
  this.write().write('*/');
  if(resume) return this.resume();
  return this;
};

MincerHtml.prototype.js = function css(scripts, resume) {
  if(typeof scripts === 'string') scripts = scripts.split(' ');
  scripts = Array.isArray(scripts) ? scripts : [scripts];
  if(resume) this.pause();
  this.write('// Generated JS bundle ' + new Date());
  this.write();
  scripts.forEach(function(file) {
    this.write('//= require ' + file);
  }, this);
  if(resume) return this.resume();
  return this;
};

MincerHtml.prototype.filter = function filter(list, extension) {
  var reg = extension instanceof RegExp ? extension : new RegExp(extension + '$');
  return list.filter(function(item) {
    return reg.test(item);
  });
};

MincerHtml.prototype.write = function write(chunk, endline) {
  endline = endline === false ? '' : (endline || '\n');
  var data = (chunk || '') + '';
  if(data === '[object Object]') data = JSON.stringify(chunk, null, 2);
  if(this._resumed) this._resumedBuffer.push(data);
  else this.emit('data', data + endline);
  return this;
};

MincerHtml.prototype.pause = function pause() {
  this._resumed = true;
  this._resumedBuffer = [];
};

MincerHtml.prototype.resume = function resume() {
  this._resumed = false;
  return this._resumedBuffer.join('\n');
};

// XXX use debug package
MincerHtml.prototype.debug = function debug() {
  if(this.options.debug) {
    console.error.apply(console, arguments);
  }
  return this;
};

MincerHtml.prototype.log = function log() {
  var args = Array.prototype.slice.call(arguments);
  var isArray = typeof args[1] === 'number' && Array.isArray(args[2]);
  if(isArray) args = args.slice(0, 1);
  console.error.apply(console, args);
  return this;
};

MincerHtml.prototype.info = function info() {
  console.error.apply(console, arguments);
  return this;
};

MincerHtml.prototype.inspect = function inspect(obj, showHidden) {
  console.error(util.inspect(obj, showHidden, 2, true));
  return this;
};
