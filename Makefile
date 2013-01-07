
all: clean test

stdin:
	node index.js styles/*.css

%.css:
	node index.js styles/*.css --sourcemap $@ > $@

clean:
	-rm test.css

test: test.css

.PHONY: sourcemap test

