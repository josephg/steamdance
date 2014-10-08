.PHONY: watch

watch:
	watchify -i graphviz -n -t coffeeify --extension=".coffee" examples/compiled.coffee -o examples/compiled.js -v

examples/compiled.js: fullscreen/*.coffee examples/compiled.coffee node_modules/boilerplate-compiler/*.js
	browserify -i graphviz -n -t coffeeify --extension=".coffee" examples/compiled.coffee -o examples/compiled.js -v

