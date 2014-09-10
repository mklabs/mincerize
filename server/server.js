
var fs       = require('fs');
var path     = require('path');
var util     = require('util');
var parse    = require('url').parse;
var mincer   = require('mincer');
var debug    = require('debug')('mincerize:server');
var Errback  = require('./errback');

// Mincer Server
//
// This wraps and inherit from Mincer.Server to report back compilation error
// and eventually display them on request.

module.exports = Server;

// we don't expose the manifest argument, if the goal is to use it for
// production, use mincer.Server directly.
function Server(env, opts) {
  mincer.Server.call(this, env);

  opts = this.options = opts || {};
  opts.mount = '/' + (opts.mount || 'assets').replace(/^\//, '');
  opts.base = path.resolve(opts.base || './');
}

util.inherits(Server, mincer.Server);

// Handle wrap to perform a check before going through Mincer. Mincer
// currently ends the request at handle level in case of Errors. We want
// to display, in dev, error information per request.
Server.prototype.handle = function handle(req, res, next) {
  var self = this;
  this.check(req, res, next, function() {
    mincer.Server.prototype.handle.call(self, req, res);
  });
};

// Avoid 404 / 500 to go through mincer, and catch up errors. If
// everything went fine, then go through the Mincer handler
Server.prototype.check = function check(req, res, next, done) {
  var mountpoint = this.options.mount;

  var parsedUrl = parse(req.url);

  // normalize urls and replace the mountpoint from pathname
  var pathname = parsedUrl.pathname.replace(new RegExp('^/?' + mountpoint), '');
  var extname = path.extname(parsedUrl.pathname);

  // Bypass request to sourcemaps and/or images
  if (extname !== '.js' || extname !== '.css') return done();

  try {
    pathname = decodeURIComponent(pathname.replace(/^\//, ''));
  } catch (err) {
    return next(new Error('Failed decode URL', timer.stop()));
  }

  debug('Handle request %s (mount point: %s)', pathname, mountpoint);

  // ignore non-GET requests
  if ('GET' !== req.method && 'HEAD' !== req.method) {
    return next(new Error('HTTP method not allowed'));
  }

  // ?body=true let you prevent the bundle mode
  var bundle = !/body=[1t]/.test(parsedUrl.query);

  var self = this;

  // compile and see how it goes
  this.compile(pathname, bundle, function(err, asset) {
    if(err) {
      debug('Error compiling asset', pathname);
      return self.error(err, req, res, next);
    }

    if(!asset) {
      return self.notfound(req, res, next);
    }

    done();
  });
};

// Error handlers
//
// XXX refactor out, dispatch to other methods for each content-type
// XXX a way to conditionnaly output on accept header in Errback
// XXX remove sync calls in error decorators

// Asset not found handler
Server.prototype.notfound = function notfound(req, res, next) {
  debug('Asset not found', req.url);
  var env = this.environment;
  var opts = this.options;
  // Error: Could not find file
  function link(filepath) {
    if(!filepath) return '';
    filepath = path.relative(opts.base, filepath) || './';
    return '<li><a href="/{href}">{text}</a></li>'
      .replace('{href}', filepath)
      .replace('{text}', filepath);
  }

  res.statusCode = 404;
  fs.readFile(path.join(__dirname, 'public/error.html'), 'utf8', function(e, html) {
    if(e) return next(e);
    fs.readFile(path.join(__dirname, 'public/error.css'), 'utf8', function(e, style) {
      if(e) return next(e);

      var buf = '';
      buf += '<h2>Cannot find asset ' + req.url + '</h2>';
      buf += '<p class="detail">Configured paths</p>';
      buf += '<ul class="paths">';
      buf += env.paths.sort().map(link).join('\n');
      buf += '</ul>';

      var assets = Object.keys(env.__assets__);

      var known = [];
      if(assets.length) {
        buf += '<p class="detail">List of compiled assets</p>';
        buf += '<ul class="paths">';
        buf += assets.map(function(asset) {
          asset = asset.replace(/\d$/, '');
          if(~known.indexOf(asset)) return;
          known.push(asset);
          return asset;
        }).sort().map(link).join('\n');
        buf += '</ul>';
      }

      html = html
        .replace('{style}', style)
        .replace(/\{title\}/g, res.statusCode + ' - not found')
        .replace('{statusCode}', res.statusCode)
        .replace('{body}', buf);


      res.writeHead(res.statusCode, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    });
  });
};

// Compilation error handler
//
// or the big mess
//
// XXX break this down
Server.prototype.error = function _error(err, req, res, next) {
  var options = this.options;
  if (err.status) res.statusCode = err.status;
  if (res.statusCode < 400) res.statusCode = 500;
  res.statusCode = res.statusCode || 500;

  var accept = req.headers.accept || 'html';
  debug('%d Error %s', res.statusCode, req.url, accept);
  // req ending by .js ? then change the accept from */* to a less generic one
  if(path.extname(req.url) === '.js' && accept === '*/*') accept = 'application/javascript';

  // catch up for known mincer directive errors
  err = this.decorateDirectiveError(err);

  // html / js
  if (~accept.indexOf('html') || ~accept.indexOf('javascript')) {
    fs.readFile(path.join(__dirname, 'public/error.html'), 'utf8', function(e, html) {
      if(e) return next(e);
      fs.readFile(path.join(__dirname, 'public/error.css'), 'utf8', function(e, style) {
        if(e) return next(e);

        var body = err.message.trim()
          .replace('Error compiling asset:', '');

        // has not been decorated by errback, decorate a little
        if(!/<pre>/.test(body)) body = '<pre class="standalone">' + body + '</pre>';

        html = html
          .replace('{style}', style)
          .replace(/\{title\}/g, 'Compilation Error')
          .replace('{statusCode}', res.statusCode || err.code)
          .replace('{body}', body);

        if(~accept.indexOf('html')) {
          res.writeHead(res.statusCode, { 'Content-Type': 'text/html; charset=utf-8' });
          return res.end(html);
        }

        fs.readFile(path.join(__dirname, 'public/error-response.js'), 'utf8', function(e, js) {
          if(e) return next(e);

          var filename = options.mount + req.url;
          res.writeHead(200, { 'Content-Type': 'application/javascript' });

          // reason
          var reason = (err.message.match(/<p class="detail">([^<]+)<\/p>/) || [])[1];

          // and get back escaped html
          body = encodeURIComponent(body);
          style = encodeURIComponent(style);
          reason = encodeURIComponent(reason);

          js = js
            .replace('{title}', 'Compilation Error')
            .replace('{filename}', filename)
            .replace('{reason}', reason)
            .replace('{body}', body)
            .replace('{style}', style);

          res.end(js);
        });
      });
    });
  // json
  } else if (~accept.indexOf('json')) {
    var error = { message: err.message, stack: err.stack };
    for (var prop in err) error[prop] = err[prop];
    var json = JSON.stringify({ error: error });
    res.writeHead(res.statusCode, { 'Content-Type': 'application/json' });
    res.end(json);

  // CSS
  } else if(~accept.indexOf('css')) {
    res.writeHead(200, { 'Content-Type': 'text/css' });
    var css = 'body:before { content: "Error compiling assets"';
    fs.readFile(path.join(__dirname, './public/error-response.css'), 'utf8', function(e, css) {
      if(e) return next(e);
      var filename = options.mount  + req.url;

      // parse reason
      var reason = (err.toString().match(/<p class="detail">([^<]+)<\/p>/) || [])[1];
      css = css
        .replace(/\{title\}/g, 'Compilation Error')
        .replace('{after}', 'File:' + filename + '- Reason: ' + (reason || err.message.replace(/'/g, '"')));
      res.end(css);
    });

  // plain text
  } else {
    res.writeHead(res.statusCode, { 'Content-Type': 'text/plain' });
    res.end(err.stack);
  }
};

Server.prototype.decorateDirectiveError = function decorateDirectiveError(err) {
  var file = (err.message.match(/\(in (.+)\)$/) || [])[1];

  if(/^Could not find file/.test(err.message)) {
    return this.fileNotFoundError(err, file);
  }

  if(/^require_tree argument must be a directory/.test(err.message)) {
    return this.requireTreeError(err, file);
  }

  return err;
};

Server.prototype.fileNotFoundError = function fileNotFoundError(err, file) {
  var msg = err.message;
  var required = (msg.match(/^Could not find file '([^']+)'/) || [])[1];
  debug('Could not find %s in %s', required, file);

  var body = fs.readFileSync(file, 'utf8');
  var line = 0;
  body.split(/\r?\n/).forEach(function(l, i) {
    if(line) return;
    if(~l.indexOf(required)) line = i + 1;
  });

  var errback = new Errback([{
    message: 'Could not find ' + required,
    line: line,
    col: 1
  }], {
    file: file,
    source: body
  });

  err.message = errback + '';
  err.errback = errback;
  return err;
};

Server.prototype.requireTreeError = function requireTreeError(err, file) {
  debug('Require tree error in %s', file);

  var env = this.environment;
  var body = fs.readFileSync(file, 'utf8');
  var lines = body.split(/\r?\n/);
  var asset = env.findAsset(file);

  var matches = [];
  lines.forEach(function(l, i) {
    if(~l.indexOf('require_tree')) matches.push(i + 1);
  });

  var errors = matches.filter(function(l) {
    var line = lines[l - 1];
    var tree = (line.match(/require_tree\s*(.+)/) || [])[1];
    var filepath = path.resolve(path.dirname(asset.pathname), tree);
    return !fs.existsSync(filepath);
  }).map(function(line) {
    return {
      message: err.message,
      line: line,
      col: 1
    };
  });

  var errback = new Errback(errors, {
    file: file,
    source: body
  });

  err.message = errback + '';
  err.errback = errback;
  return err;
};
