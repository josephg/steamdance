.PHONY: watch

watch:
	watchify -i chalk -n -t coffeeify --extension=".coffee" -t [babelify --presets [ es2015 ] ] -t glify browser/index.coffee -o browser/compiled.js -v

browser/compiled.js: browser/index.coffee node_modules/boilerplate-compiler/*.coffee
	browserify -i chalk -n -t coffeeify --extension=".coffee" -t [babelify --presets [ es2015 ] ] browser/index.coffee -o browser/compiled.js -v

