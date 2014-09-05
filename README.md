Boilerplate
===========

Boilerplate is a steam powered computery thing.

[Watch the youtube video to understand how it works](https://youtu.be/jLET1hwIsIk)

[Try it out yourself!](https://josephg.com/boilerplate/)

This repository contains the boilerplate web library and 3 working examples of
its use:

- A boilerplate client / server for collaborative editing of your funny computers
- An in-browser editor which saves everything you make to localstorage. You can
  [mess around with that online](https://josephg.com/boilerplate/).
- Embedded boilerplate, for putting little bundles of puzzly love inline in a
  webpage.

The boilerplate simulator is *not included*. That [lives in its own
repository](/josephg/boilerplate-sim).


## Running the server

Boilerplate's main implementation is the collaborative client-server
environment where you can mess around with steam power. All worlds are
automatically saved to leveldb when they get edited.

```
% git clone ...
% cd boilerplate
% npm install
% npm install -g coffee-script
% make
% coffee server.coffee
```

## Where is all the code?

The code to make boilerplate work is in three pieces:

1. The simulator code is in the [boilerplate-sim](https://www.npmjs.org/package/boilerplate-sim) npm package.
2. The web client code is all in
[boilerplate.coffee](public/boilerplate.coffee).
This code is boilerplate's web UI, binding DOM events to boilerplate
modifications and vice versa.
3. The code to actually manage the client/server interaction is in
[server.coffee](server.coffee) and
[public/client.coffee](public/client.coffee). It works over websockets.

There's also some examples of different ways you can use the view code in the examples directory.





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


