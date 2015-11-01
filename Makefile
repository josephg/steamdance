.PHONY: watch

watch:
	watchify -i graphviz -n -t coffeeify --extension=".coffee" browser/compiled.coffee -o browser/compiled.js -v

browser/compiled.js: browser/compiled.coffee node_modules/boilerplate-compiler/*.coffee
	browserify -i graphviz -n -t coffeeify --extension=".coffee" browser/compiled.coffee -o browser/compiled.js -v

