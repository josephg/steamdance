.PHONY: watch watch-browse

watch:
	watchify -i chalk -n -t coffeeify --extension=".coffee" -t [babelify --presets [ es2015 ] ] -t glify browser/editor.js -o public/editor-compiled.js -v

watch-browse:
	watchify -n -t [ babelify ] -t glify browser/browse.js -o public/browse-compiled.js -v

public/editor.js: browser/editor.js node_modules/boilerplate-compiler/*.coffee
	browserify -i chalk -n -t coffeeify --extension=".coffee" -t [babelify --presets [ es2015 ] ] browser/index.coffee -o browser/compiled.js -v
