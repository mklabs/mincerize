var fs     = require('fs');
var path   = require('path')
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
  this.matchCss = options.matchCss || /\s*<link.+href="([^"]+)"/;
  this.matchJs = options.matchJs || /\s*<script.+src="([^"]+)"/;

  this.parse();
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

  // Filter out ignored files
  if (this.options.ignore) assets = assets.filter(function(asset) {
    return this.options.ignore.filter(function(ignore) {
      return !!~asset.indexOf(ignore);
    }).length === 0;
  }, this);

  // Filter out assets not prefixed by "prefix"
  if (this.options.prefix) assets = assets.filter(function(asset) {
    return !!~asset.indexOf(this.options.prefix);
  }, this);

  // Extract relative path based to prefix
  if (this.options.prefix) assets = assets.map(function(asset) {
    return asset.replace(this.options.prefix, '');
  }, this);

  this.assets = this.assets.concat(assets);

  return this;
};

MincerHtml.prototype.parseLine = function parseLine(line) {
  var filepath = (line.match(this.matchCss) || [])[1];
  if(!filepath) filepath = (line.match(this.matchJs) || [])[1];
  return filepath || '';
};

MincerHtml.prototype.filter = function filter(list, extension) {
  var reg = extension instanceof RegExp ? extension : new RegExp(extension + '$');
  return list.filter(function(item) {
    return reg.test(item);
  });
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
