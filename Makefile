sources := browse.js editor.js

.PHONY: all all-min
all: $(sources:%.js=public/%-compiled.js)
all-min: $(sources:%.js=public/%-compiled-min.js)

.PHONY: clean
clean:
	rm -f public/*compiled*

public/%-compiled.js: browser/%.js lib/*.js
	npx browserify -i chalk -p yo-yoify $< -o $@

public/%-compiled-min.js: browser/%.js lib/*.js
	npx browserify -i chalk -t unassertify -g yo-yoify -g uglifyify $< -o $@
