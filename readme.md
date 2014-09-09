mincerize
=========

A set of scripts working together with Mincer, providing an easy way to
compile and replace JS or CSS files based on an HTML file (or template).

### mincer-html

This command takes an HTML file and returns a list of matching assets,
JS or CSS file.

    Usage: mincer-html [options]

    Options:

      -h, --help                output usage information
      -g, --grep <grep>         Only output assets matching the provided pattern
      -i, --ignore <ignore>     Ignore assets matching the provided pattern
      -f, --filename <filname>  Define the name of the input file
      --css                     Only output stylesheets
      --js                      Only output javascript


**Example**

    $ mincer-html --filename ./examples/todo-backbone/index.html


### mincer-build

This command takes an HTML file, and:

1. Figure out the assets
2. Pass each asset through mincer, with --output option set (manifest generation)
3. Replace each reference in input HTML to the new, revved, one
4. Outputs the result to stdout

---

    Usage: mincer-build [options]

    Options:

      -h, --help                output usage information
      -d, --debug               Turn on debugging info
      -I, --include <path>      Adds the directory to the Mincer load path. Comma separated list of values
      -i, --ignore <ignore>     Ignores the given string from assets to compile (relative to input file). Comma separated list of values
      -o, --output              Copy provided assets into the provided directory
      -f, --filename <filname>  Define the name of the input file


    Examples:

      $ mincer-build -I ./bower_components -I ./app/assets/ -o build -f index.html
      $ mincer-build --ignore googleapi -f index.html

**Example**

    $ mincer-build -f examples/todo-backbone/index.html -I bower_components > new.html
