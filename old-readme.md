mincer-sourcemap
================

*assets sourcemapping (post)processor*

This is a thing that take a mincer / sprockets output stream of JS or CSS as
input, and outputs the minified (or not minified bundle) with according
sourcemap.

While it falls back to reasonable behavior when not used with
[mincer](git://github.com/nodeca/mincer.git), it is primary built for the
purpose of parsing mincer stream, and works best in that scenario.

## Example

Sourcemap is always generated relative to the input file. Debug statements are
always displayed on STDERR, while STDOUT ouputs the final JS or CSS result
(`--output` can also be used to redirect the output to a given file)

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
```

```
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
ordered list of assets.

The list of JS files is passed to UglifyJS2 with sourcemap generation,
in minify or beautified mode.

The stream also parses the input and the end of the file for initial
`sourceMappingURL` to use as `inSourceMap` option.

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

Not minify the content. This is particularly useful in dev environment, significantly faster.

```
$ mincer-sourcemap file.js --nocompress
$ mincer-sourcemap file.js --dev
```

Generate with explicit sourcemap's filename (otherwise, it is guessed from
input)

```
$ mincer-sourcemap file.js --source-map file.map
```

Generate with sourcemap's sourceRoot

```
$ mincer-sourcemap file.js --source-map-root /
```

Remove a path prefix from sourcemap's sources array of files. This is often
useful when you trigger the build from another directory, not relative to the
final web application root.

```
$ mincer-sourcemap public/javascript/app.js --prefix public/javascript
```

Redirect the output to a specific file

```
$ mincer-sourcemap public/javascript/app.js --output public/javascript/app.bundle.js
# same as
$ mincer-sourcemap public/javascript/app.js > public/javascript/app.bundle.js
```

Specify the `in-source-map` option.

```
$ mincer-sourcemap public/javascript/app.js --in-source-map public/javascript/app.map
```

Unless `--in-source-map` is explicitly set, the end of the input file
is parsed looking for an existing `sourceMappingURL` to use as
sourcemap input. This is ofen useful if you wish to chain targets and
streams, or maybe generate proper sourcemapping for CoffeeScript output
generated with [CoffeeScriptRedux](http://michaelficarra.github.com/CoffeeScriptRedux/)

```
$ mincer-sourcemap assets/base.js --dev | mincer-sourcemap --sourcemap assets/base.min.js.map
... No sourcemap option defined, but only a single entry file. Defaults sourcemap to assets/base.js.map ...
... Generate sourcemap to assets/base.js.map ...
... Found sourceMappingURL in input stream. Setting UglifyJS2 option to assets/base.js.map ...
WARN: Couldn't figure out mapping for assets/base.min.js.js:1,0 → 1,1 []
... Generate sourcemap to assets/base.min.js.map ...
(function(){"use strict";"todomvc.com"===location.hostname&&function(e,t){var o=e.createElement(t),n=e.getElementsByTagName(t)[0];o.src="//www.google-analytics.com/ga.js",n.parentNode.insertBefore(o,n)}(document,"script")})(window);
//@ sourceMappingURL=assets/base.min.js.map
```

In any of the above scenarios, the resulting JS, minified or not, is
dumped to `stdout` (unless `--output` is set) whereas the according
sourcemap is written manually, at the specified `--sourcemap` filepath,
or based on file input (in the worst case, the sourcemap defaults to
`mincer.map`)

## API

### minmap

`minmap()` is the basic wrapper to MinmapStream, taking a raw String of JS
as input and outputs the according minified version with sourcemap.

Examples

    minmap('var str = "of js";', opts).pipe(process.stdout);

Returns a MinmapStream instance.

### MinmapStream

The `MinmapStream` object is a writable stream, that takes the raw body of
JavaScript to parse and outputs the minified output with sourcemap
generation if `/*** filepath ***/` are included within the file (case of
standard mincer output with LineComments post processor)

The end of the file is also parsed looking for an input sourcemap to pass
through uglify-js, unless `options.inSourceMap` is explicitely set

The list of filepath is parsed from content, and then passed through
uglify-js2 minification with sourcemap output.

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

Simple facade to uglify-js2 processing. Outputs the list of assets
path in debug mode and write the current content if no assets were
found.

Returns the minmap stream instance.

### MinmapStream#uglify

UglifyJS2 based generation. Parses tree, compress & mangle if in compress
mode, then generates the code & sourcemap output.

Returns the minmap stream instance.

