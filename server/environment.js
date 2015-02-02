//
// Require some modules
//


var path      = require('path');
var Mincer    = require('mincer');


//
// Configure Mincers logger, by default, all
// messages are going to the middle of nowhere
//


Mincer.logger.use(console);


//
// Create and export environment
//


var environment = new Mincer.Environment(process.cwd());

// Exports

module.exports = function _environment(options) {

  // Enable source maps support
  environment.enable('source_maps');
  environment.enable('autoprefixer');
  //environment.sourceRoot = '/'; // use to cheat nesting level in dev tools

  // Configure environment load paths (where to find ssets)
  options.include.forEach(environment.appendPath, environment);

  // Defaults include paths
  environment.appendPath('bower_components');

  return environment;
};
