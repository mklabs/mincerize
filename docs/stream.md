### Stream EVERYTHING

We should be able to do crazy stuff like this

---

Parse out the JS / CSS assets, output the listing*

    $ cat index.html | mincer-html


Read the input file listing, pass them all to mincer output the concatanated
result CSS / JS can be mixed, but another stream may read from this path and
write back each one to file system.

*mincer-compile is a simple wrapper on top of mincer, to be able to read from stdin mainly.*

    $ cat index.html | mincer-html | mincer-compile

concat / minification / sourcemap compilation step

In case of mixed CSS / JS input, outputs the compiled output with comment
filepath info (eg. `/*** path/to/file.css ***/`) between each file.

This may generate a bunch of *.map files, next to the original file

    $ cat index.html | mincer-html | mincer-compile | mincer-sourcemap

Revving step, simply updates the filepath to the versioned one, based on
content hash.

    $ cat index.html | mincer-html | mincer-compile | mincer-sourcemap | mincer-rev

Write back to the filesytem step this splits out a chunk compiled JS / CSS and
writes each part back to the filesystem, based on the comment filepath value.

The output is the same as the input.

    $ cat index.html | ... | mincer-rev | mincer-write

Update references in `index.html` each filepath that appear in the input stream

    $ cat index.html | ... | mincer-write | mincer-html index.html


Or simply, which include everything

    $ cat index.html | mincer-build

- Parse out index.html
- get back the list of assets to precompile
- For each asset, compile through mincer (include dir relative to index.html)
- Compile sourcemapping for each asset
- Compute file sha1 for each file.
- Replace the original filename to the final one

## API

As for the JS API, every command is a basic `noptify` program in the `bin`
folder, each one using the according stream in `lib/`.

```js
var minmap = require('minmap');

var program = noptify();

// ... program config options, shorthands, usage etc ...

// and then ...

program.pipe(new minmap.HtmlStream).pipe(process.stdout);
```

A command file that pipe streams in a single raw:

- Parse out index.html
- get back the list of assets to precompile
- For each asset, compile through mincer (include dir relative to index.html)
- Compile sourcemapping for each asset
- Compute file sha1 for each file.
- Replace the original filename to the final one
- Minify the resulting HTML

```js
program
  .pipe(new minmap.HtmlStream)
  .pipe(new minmap.MincerStream)
  .pipe(new minmap.SourcemapStream)
  .pipe(new minmap.RevStream)
  .pipe(new minmap.WriteStream)
  .pipe(new minmap.UseminStream({ file: 'index.html' }))
  .pipe(new minmap.HtmlMinifierStream)
  .pipe(process.stdout);
```


```js
// also valid
program.pipe(minmap.MincerStream());

program
  .pipe(minmap('html'))
  .pipe(minmap('html'))
  .pipe(process.stdout)

minmap('mincer', options).pipe(process.stdout);
```
