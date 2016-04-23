Steam Dance
===========

Steamdance is a steam powered computery thing. It used to be called
boilerplate, but that name was super overloaded so we renamed it. You might see
some references to boilerplate kicking around.

[Watch the youtube video to understand how it works](https://youtu.be/jLET1hwIsIk)

[Try it out yourself!](https://steam.dance/)

(Or try the [old localstorage version](https://josephg.com/boilerplate/))

This repository contains the steamdance web library and a hosted server making use of it.

There's also some other fun stuff - The old simulator [lives in its own
repository](https://github.com/josephg/boilerplate-sim). There's also a
[boilerplate compiler](https://github.com/josephg/boilerplate-compiler) I made ages ago to take programs and produce runnable javascript.

But the current runtime compiler is [the JIT compiler](https://github.com/josephg/boilerplate-jit), which does just-in-time parsing and traversal.


## Running the server

The server stores worlds in a little local leveldb instance.

```
% git clone ...
% cd steamdance
% npm install
% node server.js
```



---

# License

> Standard ISC License

Copyright (c) 2011-2014, Joseph Gentle, Jeremy Apthorp

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND
FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.


