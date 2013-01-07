var fs        = require('fs');
var util      = require('util');
var nopt      = require('nopt');
var path      = require('path');
var parse     = require('css-parse');
var stringify = require('css-stringify');

var opts = nopt({ sourcemap: String });
var files = opts.argv.remain;

var asts = files.map(function(file) {
  var body = fs.readFileSync(file, 'utf8');
  return {
    file: file,
    body: body,
    ast: parse(body, {
      filename: file,
      prefix: process.cwd()
    })
  };
});

var combined = parse('');
combined.stylesheet.rules = asts.reduce(function(rules, file) {
  var ruleset = file.ast.stylesheet.rules;
  return rules.concat(ruleset);
}, []);

// Will noptify all this tomorrow
console.log(stringify(combined, { compress: true, sourcemap: opts.sourcemap || 'stdin' }));
