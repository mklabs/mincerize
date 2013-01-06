
BUILD_DIR ?= build

PATH := ./node_modules/.bin:$(PATH)

clean-dry:
	git clean -fdx --dry-run -e node_modules

clean:
	git clean -fdx -e node_modules

$(BUILD_DIR):
	cat mincer.html | mincer-html
	mincer $(shell mincer-html mincer.html -grep manifest) -o $@

mincerize: $(BUILD_DIR)

sourcemap:
	mincer-sourcemap

.PHONY: clean-dry clean mincerize
