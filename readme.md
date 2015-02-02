mincerize
=========

A set of scripts working together with Mincer, providing an easy way to
compile and replace JS or CSS files based on an HTML file (or template)
as well as a development server.

### mincerize

Top level command

    Usage: mincerize [options] [command]

    Commands:

      html
         Parse and outputs the list of matching assets from an HTML file

      build
         Compiles and produces Mincer manifest from an HTML file

      serve
         Start an asset pipeline development server

      help [cmd]
         display help for [cmd]


    Options:

      -h, --help  output usage information

### mincerize-serve

A development server based on Mincer with file watching utility and
livereload.

- Automatically watch any file within one of Mincer's include paths
- Integration with Bower (bower_components added as an include paths)
- Livereload event when a file changes
- Development friendly error, based on and inspired by Play framework.

---


    Usage: mincerize-serve [options]

    Options:

      -h, --help                output usage information
      -M, --mount <mountpoint>  Specify the mount point for the Asset Pipeline(default: assets)
      -p, --port <port>         Specify the port to listen on (default: 3000)
      -I, --include <path>      Adds the directory to the Mincer load path
      -i, --ignore <ignore>     Ignores the given string from assets to compile
      -w, --watch               Turn on watching of files in include paths to trigger a LiveReload event



**Examples**


Clone the repo locally and cd into the examples folder.

    $ git clone
    $ npm install
    $ cd examples/mincer && bower install
    $ mincerize serve

### mincerize-html

This command takes an HTML file and returns a list of matching assets,
JS or CSS file.

    Usage: mincerize-html [options]

    Options:

      -h, --help                output usage information
      -i, --ignore <ignore>     Ignore assets matching the provided pattern
      -f, --filename <filname>  Define the name of the input file
      --css                     Only output stylesheets
      --js                      Only output javascript


**Example**

    $ mincerize html --filename ./examples/todo-backbone/index.html


### mincerize-build

This command takes an HTML file, and:

1. Figure out the assets
2. Pass each asset through mincer, with --output option set (manifest generation)
3. Replace each reference in input HTML to the new, revved, one
4. Outputs the result to stdout

---

    Usage: mincerize-build [options]

      Options:

        -h, --help                output usage information
        -d, --debug               Turn on debugging info
        -p, --prefix <prefix>     Extracts asset relative path based on this prefix
        -I, --include <path>      Adds the directory to the Mincer load path. Comma separated list of values
        -i, --ignore <ignore>     Ignores the given string from assets to compile (relative to input file). Comma separated list of values
        -o, --output <directory>  Build assets into the provided directory
        -f, --filename <filname>  Define the name of the input file
        -c, --compress            Turn on compression for JS / CSS (using uglify / csswring)
        -s, --sourcemap           Turn on sourcemap generation


    Examples:

        $ mincer-build -I ./bower_components -I ./app/assets/ -o build -f index.html
        $ mincer-build --ignore googleapi -f index.html


**Example**

    $ mincerize build -f examples/todo-backbone/index.html -I bower_components > new.html
