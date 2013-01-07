
all: clean test debug

TEST_FILE ?= test.css

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

test: $(TEST_FILE)

.PHONY: sourcemap test

