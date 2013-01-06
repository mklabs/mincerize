
To start the webserver and browse the example, simply run:

```sh
$ npm install && npm start
```

## Synopsis

Start from index.html, ends up with mincer.html and revved CSS / JS with sourcemaps.

```
# list assets
$ cat index.html | mincer-html

# generate manifest and HTML
$ cat index.html | mincer-html -c -i ie.js --dirname assets > mincer.html

# list assets
$ cat mincer.html | mincer-html

# generate bundles
$ mincer $(mincer-html mincer.html -grep manifest) -o build

# replace reference in HTML to the final revved bundle
$ mincer-html -
```


### Examples

#### mincer-html(1)

```sh
  Usage: mincer-html [options]

  Options:
    -h, --help         	- Show help usage
    -v, --version      	- Show package version
    -g, --grep         	- Only output assets matching the provided pattern
    -i, --ignore       	- Ignore assets matching the provided pattern
    -b, --bundle       	- Output valid JS or CSS bundle to stdout
    -c, --convert      	- Generate valid JS or CSS bundle from input and replace references to generated manifest(s)
    -f, --filename     	- Define the name of the input file, usefull for stdin type of input
    -dir, --dirname    	- Directory value where manifest bundles are generated
    --css              	- Only output stylesheets
    --js               	- Only output javascript

  Shorthands:
    --h  		--help
    --v  		--version
    --g  		--grep
    --i  		--ignore
    --b  		--bundle
    --c  		--convert
    --f  		--filename
    --dir		--dirname
```

Generate CSS bundle from HTML

```sh
$ mincer-html index.html -b --css
$ mincer-html index.html -b --css > assets/manifest.css
```

Generate JS bundle from HTML

```sh
$ mincer-html index.html -b --js
$ mincer-html index.html -b --js > assets/manifest.js
```

Generate JS / CSS bundle from HTML, writing them to the file system, replaces reference in HTML input and output the result.

```sh
$ mincer-html index.html -c --ignore ie.js --dirname assets > mincer.html
... Writing CSS manifest bundle to assets/manifest.css ...
... Writing JS manifest bundle to assets/manifest.js ...
```

### mincer-sourcemap(1)

```sh

  Usage: mincer-sourcemap [options]

  Options:
    -h, --help             	- Show help usage
    -v, --version          	- Show package version
    --output               	- The output stream (default: process.stdout)
    --source-map           	- The generated sourcemap location
    --source-map-root      	- Sourcemap root option
    --source-map-prefix    	- Rewrites sources Array in genrated sourcemap to remove this prefix value
    --in-source-map        	- Explicitely specificy the input sourcemap, otherwise guess from input
    --nocompress           	- Outputs JS in beautified mode instead of the standard minification
    --css-debug-host       	- Generates `-sass-debug-info` with filename based on this HTTP host (instead of absolute filepath)
    --css-debug-prefix     	- Only relevant with css-debug-host and acts like source-map-prefix
    --css                  	- Turn the compilation mode into `.css`. Useful for stdin input. JS is the default mode.

  Shorthands:
    --sourcemap     		--source-map
    --prefix        		--source-map-prefix
    --root          		--source-map-root
    --sourcemap-root		--source-map-root
    --nominify      		--nocompress
    --no-minify     		--nocompress
    --no-compress   		--nocompress
    --css-host      		--css-debug-host
    --host          		--css-debug-host
    --css-prefix    		--css-debug-prefix
    --dev           		--nocompress
    --h             		--help
    --v             		--version


  Examples:

    # js
    $ mincer assets/javascript/manifest.js | mincer-sourcemap
    $ mincer-sourcemap assets/javascript/app.bundle.js

    # css
    $ cat public/stylesheets/app.bundle.css | mincer-sourcemap --css
    $ mincer-sourcemap public/stylesheets/app.bundle.css --css-debug-host http://localhost:3000

```

Generate JS bundle in non minified mode (`--dev`)

```sh
mincer assets/manifest.js | mincer-sourcemap -dev > assets/manifest.bundle.js
... No sourcemap option defined. Will default sourcemap to assets/manifest.map ...
... Generate sourcemap from the following files ...
... assets/ie.js ...
... assets/base.js ...
... assets/jquery.min.js ...
... assets/lodash.min.js ...
... assets/js/lib/backbone-min.js ...
... assets/js/lib/backbone-localstorage.js ...
... assets/js/models/todo.js ...
... assets/js/collections/todos.js ...
... assets/js/views/todos.js ...
... assets/js/views/app.js ...
... assets/js/routers/router.js ...
... assets/js/app.js ...
... assets/manifest.js ...
... Generate sourcemap to assets/manifest.map ...
```

Generate minified JS bundle

```sh
$ mincer assets/manifest.js | mincer-sourcemap > assets/manifest.bundle.min.js
```

Generate JS minified bundle from previously compiled bundle in `--dev` mode.
Notice the `... Found sourceMappingURL in input stream. ...` debug info.

```sh
$ mincer assets/manifest.js | mincer-sourcemap --dev | mincer-sourcemap --sourcemap assets/manifest.bundle.min.js.map > assets/manifest.bundle.min.js
... No sourcemap option defined. Will default sourcemap to assets/manifest.map ...
... Generate sourcemap from the following files ...
... assets/ie.js ...
... assets/base.js ...
... assets/jquery.min.js ...
... assets/lodash.min.js ...
... assets/js/lib/backbone-min.js ...
... assets/js/lib/backbone-localstorage.js ...
... assets/js/models/todo.js ...
... assets/js/collections/todos.js ...
... assets/js/views/todos.js ...
... assets/js/views/app.js ...
... assets/js/routers/router.js ...
... assets/js/app.js ...
... assets/manifest.js ...
... Generate sourcemap to assets/manifest.map ...
... Found sourceMappingURL in input stream. Setting UglifyJS2 option to assets/manifest.map ...
WARN: Couldn't figure out mapping for assets/manifest.bundle.min.js.js:3,0 → 1,154 []
... Generate sourcemap to assets/manifest.bundle.min.js.map ...
```

Generate CSS bundle with `-sass-debug-info`.

```sh
$ mincer assets/manifest.css | mincer-sourcemap --css --host localhost:3000 > assets/manifest.bundle.css
... Generate sourcemap from the following files ...
... assets/base.css ...
... assets/manifest.css ...
```

