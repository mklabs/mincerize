mincer-sourcemap
================

*assets sourcemapping (post)processor*

This is a thing that take a mincer / sprockets output stream of JS or CSS as
input, and outputs the minified (or not minified bundle) with according
sourcemap or `-sass-debug-info`.

While it falls back to reasonable behavior when not used with
[mincer](git://github.com/nodeca/mincer.git), it is primary built for the
purpose of parsing mincer stream, and works best in that scenario.

## Example

```
$ cd examples/todo-backbone
$ mincer-sourcemap assets/base.js
... No sourcemap option defined, but only a single entry file. Defaults sourcemap to assets/base.js.map ...
... Generate sourcemap to assets/base.js.map ...
(function(){"use strict";"todomvc.com"===location.hostname&&function(e,t){var o=e.createElement(t),n=e.getElementsByTagName(t)[0];o.src="//www.google-analytics.com/ga.js",n.parentNode.insertBefore(o,n)}(document,"script")})(window);
//@ sourceMappingURL=assets/base.js.map

$ cat assets/base.js.map
```

```json
{
  "version": 3,
  "file": "assets/base.js.map",
  "sources": [
    "assets/base.js.js"
  ],
  "names": [
    "location",
    "hostname",
    "d",
    "t",
    "g",
    "createElement",
    "s",
    "getElementsByTagName",
    "src",
    "parentNode",
    "insertBefore",
    "document",
    "window"
  ],
  "mappings": "CAAA,WACC,YAE2B,iBAAtBA,SAASC,UACkD,SAASC,EAAEC,GAAG,GAAIC,GAAEF,EAAEG,cAAcF,GAAGG,EAAEJ,EAAEK,qBAAqBJ,GAAG,EAAGC,GAAEI,IAAI,mCAAmCF,EAAEG,WAAWC,aAAaN,EAAEE,IAAIK,SAAS,YAErNC"
}

# install mincer separately
$ mincer assets/manifest.js -I ./ | mincer-sourcemap
... No sourcemap option defined. Will default sourcemap to assets/manifest.map ...
... Generate sourcemap from the following files ...
... assets/base.js ...
... assets/js/app.js ...
... assets/manifest.js ...
... Generate sourcemap to assets/manifest.map ...
(function(){"use strict";"todomvc.com"===location.hostname&&function(e,t){var n=e.createElement(t),o=e.getElementsByTagName(t)[0];n.src="//www.google-analytics.com/ga.js",o.parentNode.insertBefore(n,o)}(document,"script")})(window);var app=app||{},ENTER_KEY=13;$(function(){new app.AppView});
//@ sourceMappingURL=assets/manifest.map
```

## Description

The input chunk is parsed for `/*** filepath ***/` pattern to determine the
ordered list of assets, and pass it through the relevant compiler.

For JS type of inputs, the list of JS files is passed to UglifyJS2 with
sourcemap generation, in minify or beautified mode (beautified mode is flavored
in development environment, as it's significantly faster).

The stream also parses the input and the end of the file for initial
`sourceMappingURL` to use as `inSourceMap` option.

For CSS type of inputs, each CSS file is compiled through `stylus` with firebug
options enabled, generating `-stylus-debug-info` converted back to
`-sass-debug-info`. The stream also lets you rewrite the filename location to
be based on HTTP protocol, instead of the usual `file://absolute/path/name`.

## Usage

Compile sprocketized bundle through mincer first, then generate the
minified file with sourcemap

```
# install mincer separately
$ mincer assets/javascript/app.js > public/javascript/app.js
$ mincer-sourcemap public/javascript/app.js
```

Operate over stdio

```
$ mincer assets/javascript/app.js | mincer-sourcemap
```

Not minify the content

```
$ mincer-sourcemap file.js --nocompress
```

Generate with explicit sourcemap's filename (otherwise, it is guessed
from input)

```
$ mincer-sourcemap file.js --source-map file.map
```

Generate with sourcemap's sourceRoot

```
$ mincer-sourcemap file.js --source-map-root /
```

Remove a path prefix from sourcemap's sources array of files

```
$ mincer-sourcemap public/javascript/app.js --prefix public/javascript
```

Redirect the output to a specific file

```
$ mincer-sourcemap public/javascript/app.js --output public/javascript/app.bundle.js
# same as
$ mincer-sourcemap public/javascript/app.js > public/javascript/app.bundle.js
```

Specify the `in-source-map` option

```
$ mincer-sourcemap public/javascript/app.js --in-source-map public/javascript/app.map

# unless `--in-source-map` is explicitely set, the end of the input file
# is parsed looking for an existing `sourceMappingURL` to use as
# sourcemap input
```

In any of the above scenarios, the resulting JS, minified or not, is
dumped to `stdout` (unless `--output` is set) whereas the according
sourcemap is written manually, at the specified `--sourcemap` filepath,
or based on file input (in the worst case, the sourcemap defaults to
`mincer.map`)

Concat with `-sass-debug-info` source location:

```
$ cat public/stylesheets/app.bundle.css | mincer-sourcemap --css
$ mincer-sourcemap public/stylesheets/app.bundle.css
```

Generate `-sass-debug-info` with an URL prefix, instead of file-protocol based absolute filenames.

```
$ mincer-sourcemap public/stylesheets/app.bundle.css --css-debug-host http://localhost:3000
... CSS ...
@media -sass-debug-info{filename{font-family:http://localhost:3000/public/stylesheets/fonts.css}line{font-family:\0000310}}
... CSS ...
```

Generate `-sass-debug-info` by rewriting the `location.pathname` part of filename, when using `host`

```
$ mincer-sourcemap src/public/stylesheets/app.bundle.css --css-debug-host http://localhost:3000 --css-debug-prefix src
... CSS ...
@media -sass-debug-info{filename{font-family:http://localhost:3000/public/stylesheets/fonts.css}line{font-family:\0000310}}
... CSS ...

# use `prefix:replacement` pattern
$ mincer-sourcemap src/public/stylesheets/app.bundle.css --css-debug-host http://localhost:3000 --css-debug-prefix src/public:assets
... CSS ...
@media -sass-debug-info{filename{font-family:http://localhost:3000/assets/stylesheets/fonts.css}line{font-family:\0000310}}
... CSS ...
```

## API

### minmap

`minmap()` is the basic wrapper to MinmapStream, taking a raw String of JS
as input and outputs the according minified version with sourcemap.

Examples

    minmap('var str = "of js";', opts).pipe(process.stdout);

Returns a MinmapStream instance.

### MinmapStream

The `MinmapStream` object is a writable stream, that takes the raw body of
JavaScript or CSS to parse and outputs the minified output with sourcemap
generation if `/*** filepath ***/` are included within the file (case of
standard mincer output)

XXX: consider matching also on @sourceUrl that might appear in the input
XXX: generate sourcemap from CSS input (use cssp as parser, or maybe
less.parser and generate sourcemap). For now, `-sass-debug-info` statements
are used.

For JS type of input:

The end of the file is also parsed looking for an input sourcemap to pass
through uglify-js, unless `options.inSourceMap` is explicitely set

The list of filepath is parsed from content, and then passed through
uglify-js2 minification with sourcemap output.

For CSS type of input:

Turn the type into `.css` with `--css`, it'll then concat the files , generate
debug-info through stylus, convert the debugging info and output the result.

There is no minification for CSS yet, untill proper V3 sourcemap generation
is done through csso / cssp (the stylus wrapper to generate debug-info
mapping would also become unecessary)


- str              - The String of JavaScript to parse and generate from
- options          - A hash of options with the following properties:
  - js              - When set to true, defines the type extension to `.js`
  - nocompress      - When set to true, this prevents the minification process
  - sourceRoot      - The `sourceRoot` option to generate the sourcemap with
  - inSourceMap     - The initial sourcemap to consider for generating the
                      new one. When omited, the actual `str` content is
                      parsed for an existing `sourceMappingURL`.
  - outSourceMap    - The sourcemap output to generate and write to file
                      system
  - sourceMapPrefix - When defined, every `sources` filepath in the resulting
                      sourcemap is rewritten to remove this prefix value.
                      Also used to figure out the original `inSourceMap` when
                      parsed from input and `sourceMappingURL` end of file.
  - format          - Only used when using esprima / escodegen based
                      generation. Maps the escodegen `format` options.
  - compiler        - The compiler to use, one of `uglifyjs` or `esmangle`
                      (default: uglifyjs). Notice uglifyjs based output is
                      more reliable, with full support for `inSourceMap` and
                      loc mapping.
  - css             - When set to true, defines the type extension to `.css`
  - cssDebugHost    - When defined, prefix filename location with this URL
                      and use the HTTP protocol instead of `file://`
  - cssDebugPrefix  - Only used when `cssDebugHost` is defined, acts like
                      `sourceMapPrefix`, rewrites the debug info to remove
                      the relevant prefix path from output. This should be
                      relative to the defined host.


### options#type

determine type of input, JS or CSS (defaults to CSS)
XXX defaults based on stream input, should detect CSS from content

### options#cssDebugHost

cleanup host from protocol, is concat'd twice otherwise

### MinmapStream#prefix

Uses `options.sourceMapPrefix` if defined to replace the first part of `filename`

### MinmapStream#write

Emits `data` event with `chunk` of data

### MinmapStream#readInSourceMap

Check input file for existing sourcemap, only if user didn't explicitely
defined one.

The file is read in reverse order, parsing the end of the file first.

XXX: consider tweaking the regex to also catch CSS type of sourceMappingURL

Whenever a `sourceMappingURL` line is found, the stream instance
`options.inSourceMap` is updated with this value.

Returns the minmap stream instance.

### MinmapStream#writeBundle

Writes `bundle` pair of parsed AST, with `bundle.code` and `bundle.map` as
raw Strings.

`bundle.map` is written to the file system directly based on
`options.outSourceMap`, whereas `bundle.code` is written to the stream.

Returns the minmap stream instance.

### MinmapStream#generate

Simple facade to the relevant compiler (currently supports uglify-js2 and
esprima / escodegen / esmangle based generation, but notice escodegen outputs
has some issue setting up breakpoints - but filemapping is ok)

Returns the minmap stream instance.

### self#render

.set('filename', 'stdin')

### pattern

parse CSS and convert sass-debug-info if needed

### MinmapStream#debugInfo

Helper to return the String of -sass-debug-info according to `filename` and
`line`.

This optionaly rewrite stuff like the filename (to be relative to an URL for
instance instead of absolute filename) and the the -$engine-debug-info

### MinmapStream#each

each async helper

### MinmapStream#uglify

UglifyJS2 based generation. Parses tree, compress & mangle if in compress
mode, then generates the code & sourcemap output.

Returns the minmap stream instance.

### MinmapStream#esprima

Esprima / Escodegen / Esmangle based generation

Based off https://gist.github.com/4230837

XXX: Sourcemap Generation OK untill trying to set breakpoint.

Returns the minmap stream instance.

### MinmapStream#compile

Based off https://gist.github.com/4230837

Takes a `filename` and `content` of JS, generate the esprima tree, optimize
& mangle if in compress mode, generates through `escodegen` and returns the
bundle pair of code / map string output.

Returns the pair of `code` / `map` from `escodegen`

