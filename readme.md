

This is a thing that a mincer / sprockets compiled script as input
stream, and outputs the minified (or not minified bundle) with
sourcemap.


This is a thing that lets you run:

```
# install mincer separately

$ mincer assets/javascript/app.js > public/javascript/app.js
$ mincer-sourcemap public/javascript/app.js

# operates over stdio
$ mincer assets/javascript/app.js | mincer-sourcemap

# to not minify the content
$ mincer-sourcemap file.js --nocompress

# to generate with explicit sourcemap's filename (otherwise, it is
# guesed from input)
$ mincer-sourcemap file.js --source-map-root /

# to generate with sourcemap's sourceRoot
$ mincer-sourcemap file.js --source-map-root /
# to generate with sourcemap's sourceRoot
$ mincer-sourcemap file.js --source-map-root /

# to remove a path prefix from sourcemap's sources array of files
$ mincer-sourcemap public/javascript/app.js --prefix public/javascript

# to redirect the output to a specific file
$ mincer-sourcemap public/javascript/app.js --output public/javascript/app.bundle.js
# same as
$ mincer-sourcemap public/javascript/app.js > public/javascript/app.bundle.js

# To specify the `in-source-map` option
$ mincer-sourcemap --in-source-map public/javascript/app.map

# unless `--in-source-map` is explicitely set, the end of the input file
# is parsed looking for an existing `sourceMappingURL` to use as
# sourcemap input

```

In any of the above scenarios, the resulting JS, minified or not, is is
dumped to `stdout` (unless `--output` is set) whereas the according
sourcemap is written manually, at the specified `--sourcemap` filepath,
or based on file input (in the worst case, the sourcemap defaults to
`mincer.map`)
