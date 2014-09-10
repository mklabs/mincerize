
var fs     = require('fs');
var path   = require('path');
var rimraf = require('rimraf');
var spawn  = require('child_process').spawn;
var assert = require('assert');
var bin    = require.resolve('../bin/mincer-build');

describe('mincer-build', function() {

  beforeEach(function(done) {
    rimraf(path.join(__dirname, 'build'), done);
  });

  it('the binary compiles the list of matching assets', function(done) {
    var args = ['--filename', 'examples/todo-backbone/index.html', '--output', 'test/build', '-I', './'];

    var p = spawn(bin, args);
    p.stdout.pipe(process.stdout);
    p.stderr.pipe(process.stderr);

    var stdout = '';
    p.stdout.on('data', function(chunk) {
      stdout += chunk;
    });

    p.on('exit', function() {
      assert.equal(stdout, fs.readFileSync('test/fixtures/index.html', 'utf8') + '\n');

      var manifest = require('./build/manifest.json');
      assert.deepEqual(manifest, require('./fixtures/manifest.json'));

      done();
    });
  });

  it('compiles the list of matching assets', function(done) {
    var MincerBuild = require('../lib/mincer-build');
    var build = new MincerBuild(fs.readFileSync('examples/todo-backbone/index.html', 'utf8'), {
      includes: ['./', 'assets'],
      filename: 'examples/todo-backbone/index.html',
      output: 'test/build'
    });

    build.on('end', function() {
      assert.equal(build.body, fs.readFileSync('test/fixtures/index.html', 'utf8'));

      var manifest = require('./build/manifest.json');
      assert.deepEqual(manifest, require('./fixtures/manifest.json'));

      done();
    });
  });

});
