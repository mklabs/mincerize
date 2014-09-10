
var fs     = require('fs');
var spawn  = require('child_process').spawn;
var assert = require('assert');
var bin    = require.resolve('../bin/mincer-html');

describe('mincer-html', function() {

  it('the binrary outputs the list of matching assets', function(done) {
    var args = ['--filename', 'examples/todo-backbone/index.html'];
    var p = spawn(bin, args);

    p.stdout.pipe(process.stdout);
    p.stderr.pipe(process.stderr);

    var stdout = '';
    p.stdout.on('data', function(chunk) {
      stdout += chunk;
    });

    p.on('exit', function() {
      assert.equal(stdout, [
        'sass-sourcemap.css',
        'assets/manifest.css',
        'assets/manifest.js'
      ].join('\n') + '\n');
      done();
    });

  });

  it('outputs the list of matching assets', function() {
    var MincerHtml = require('../lib/mincer-html');
    var html = new MincerHtml(fs.readFileSync('examples/todo-backbone/index.html', 'utf8'));

    assert.deepEqual(html.assets, [
      'sass-sourcemap.css',
      'assets/manifest.css',
      'assets/manifest.js'
    ]);
  });

});
