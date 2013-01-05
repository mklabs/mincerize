
# Generic targets to build:
#
# - minified & non minified script + sourcemap from sprocketized (or not sprocketized) input
# - concat and generate `-sass-debug-info` from sprocketized (or not sprocketized) input
#
# This works with approximately everything, with the result of mincer or
# standard script as input, with an optional initial sourceMappingURL
# (unless explicitely defined through options, usually parsed from
# input), with minified or beautified output.
#
# `nocompress` options is most likely to be used in dev environemnet, as
# the compilation is significantly faster.
#
# **Note** This needs `mincer` and `mincer-sourcemap` available in the `$PATH`,
# add them to your package.json dependencies and install them.
#
# `./node_modules/.bin` folder should be added prior to the inclusion of this
# file with
#
# 		PATH := ./node_modules/.bin:$(PATH)

# JS

%.map: %.js
	@echo ... Buidling JS map: $@ ...
	@echo ... Computing dependencies from $< through mincer ...
	@echo ... Compiling minified script to $(patsubst %.js,%.min.js,$<) ...
	@echo
	mincer $^ | mincer-sourcemap \
		--source-map $@ \
		--source-map-prefix "$(dir $@)" \
		> $(patsubst %.js,%.min.js,$<)

%.bundle.js: %.js
	@echo ... Computing dependencies from $< through mincer ...
	@echo ... Compiling script to $@ ...
	@echo
	mincer $^ | mincer-sourcemap \
		--nocompress \
		--source-map $(patsubst %.js,%.map,$<) \
		--source-map-prefix "$(dir $@)" \
		> $@

%.min.js: %.js
	@echo ... Buidling JS map from $< ...
	@echo ... Compiling minified script to $@ ...
	@echo
	mincer-sourcemap $< \
		--source-map $(patsubst %.js,%.map,$<) \
		--source-map-prefix "$(dir $@)" \
		> $@

# CSS

%.bundle.css: %.css
	@echo ... Computing dependencies from $< through mincer ...
	@echo ... Compiling CSS to $@ ...
	@echo
	mincer $^ | mincer-sourcemap --css --css-host http://192.168.0.11:3000 > $@

%.min.css: %.css
	@echo ... Compiling minified stylesheet $< to $@ ...
	csso $< > $@
