
# Generic targets to build minified & non minified script + sourcemap
# from sprocketized or not sprocketized input
#
# This works with approximately everything, with the result of mincer or
# standard script as input, with an optional initial sourceMappingURL
# (unless explicitely defined through options, usually parsed from
# input), with minified or beautified output.
#
# `nocompress` options is most likely to be used in dev environemnet, as
# the compilation is significantly faster.

%.map: %.js
	@echo ... Buidling JS map: $@ ...
	@echo ... Computing dependencies from $< through mincer ...
	@echo ... Compiling minified script to $(patsubst %.js,%.min.js,$<) ...
	@echo
	mincer-compile $^ | mincer-sourcemap \
		--source-map $@ \
		--source-map-prefix "$(dir $@)" \
		> $(patsubst %.js,%.min.js,$<)

%.bundle.js: %.js
	@echo ... Computing dependencies from $< through mincer ...
	@echo ... Compiling script to $@ ...
	@echo
	mincer-compile $^ | mincer-sourcemap \
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
