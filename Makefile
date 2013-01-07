
all: clean test debug

TEST_FILE ?= test.css

PATH := ./node_modules/.bin:$(PATH)

stdin:
	node index.js styles/*.css

%.css:
	node index.js styles/*.css --sourcemap $@ > $@

clean:
	-rm test.css

debug:
	@echo ... CSS ...
	@cat $(TEST_FILE)
	@echo ... Sourcemap generated ...
	@echo
	@node -pe 'require("util").inspect(JSON.parse(require("fs").readFileSync("./$(TEST_FILE).map", "utf8")), true, 2, true);';
	@echo

stylus-h:
	stylus -h

less-h:
	lessc -h

sass-h:
	bundle exec sass -h

stylus:
	@stylus styles/$@/index.styl -l
	@cat styles/$@/index.css
	cp styles/$@/index.css stylus.css

less:
	@lessc styles/$@/index.less --line-numbers=comments > $@.css
	@cat $@.css

sass-map:
	bundle exec sass --style expanded --sourcemap styles/sass/index.scss sass.css

sass-line:
	bundle exec sass --style expanded -l styles/sass/index.scss sass.css -l

sass: sass-line

concat:
	@echo ... Concat $(shell ls *.css) ...
	node index.js *.css --sourcemap concat-all.css.map > concat-all.css

test: $(TEST_FILE)

.PHONY: sourcemap test

