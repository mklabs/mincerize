

// Errback interface
//
// Holds information and API to report back compilation errors.

module.exports = Errback;


function Errback(errors, opts) {
  opts = this.options = opts || {};
  this.errors = errors || [];
  this.file = opts.file || '?';
  this.body = opts.source || '';
  this.lines = opts.source.split(/\r?\n/);

  // filters undefined error
  this.errors = this.errors.filter(function(err) {
    return err;
  });
}

// print detail html for a single error
Errback.prototype.detail = function detail(error) {
  return '<p class="detail">' + (error.message || error.reason || error.raw) + '</p>';
};

// print header html for a single error
Errback.prototype.title = function title(error) {
  return '<h2>In ' + this.file  + ' at line ' + error.line + ', col ' + (error.col || error.character) + '</h2>';
};

// Generate snippet of code to display for a single error
Errback.prototype.evidence = function evidence(error) {
  var buf = '<div>';

  var offset = 5;
  var start = error.line - offset;
  this.lookaround(error.line, offset).forEach(function(code, i) {
    var line = start + (i + 1);
    buf += (line === error.line) ? '<pre class="error">' : '<pre>';
    buf += '<span class="line">' + line + '</span>';
    buf += '<span class="code">' + code + '</span>';
    buf += '</pre>';
  });

  return buf;
};

// Look around a given line number and return the surrounding lines.
Errback.prototype.lookaround = function toString(line, offset) {
  offset = offset || 5;
  var start = line - offset;
  return this.before(line, offset)
    .concat(this.lines[line - 1])
    .concat(this.after(line, offset));
};

Errback.prototype.before = function before(line, offset) {
  offset = offset || 5;
  return this.lines.slice(line - offset, line - 1);
};

Errback.prototype.after = function after(line, offset) {
  offset = offset || 5;
  return this.lines.slice(line, line + offset);
};

Errback.prototype.toString = function toString() {
  return this.errors.map(function(error) {
    return this.title(error) + this.detail(error) + this.evidence(error);
  }, this).join('\n');
};
