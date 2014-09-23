.PHONY: all

all: examples/compiler.js
	coffee -cbw public examples

examples/compiler.js:
	browserify -i graphviz -r boilerplate-compiler >| examples/compiler.js
