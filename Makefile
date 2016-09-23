.PHONY: watch watch-browse clean all

sources := browse.js editor.js

all: $(sources:%.js=public/%-compiled.js)
all-min: $(sources:%.js=public/%-compiled-min.js)

clean:
	rm public/*compiled*

public/%-compiled.js: browser/%.js lib/*.js
	browserify -i chalk -p yo-yoify $< -o $@

public/%-compiled-min.js: browser/%.js lib/*.js
	browserify -i chalk -p yo-yoify $< | buble | uglifyjs -cm > $@

