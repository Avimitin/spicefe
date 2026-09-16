# NoSleep.js media source record

- Project: [richtr/NoSleep.js](https://github.com/richtr/NoSleep.js)
- Version: `v0.12.0`
- Revision: `07fcee254724ab1b79076fbc22f3dd447649a2eb`
- Source: [`src/media.js`](https://github.com/richtr/NoSleep.js/blob/07fcee254724ab1b79076fbc22f3dd447649a2eb/src/media.js)
- License: MIT, Copyright (c) Rich Tibbett; see `LICENSE.MIT.txt`.

The two Base64 data URLs are decoded without changing their media bytes and
served locally so the existing Content Security Policy needs no changes.
`public/lib/screen-wake-lock.js` adapts the video fallback and MP4 seek behavior
from the same revision's `src/index.js`. NoSleep's legacy page-reload workaround
is not included.

| File | SHA-256 |
| --- | --- |
| `wake-lock.webm` | `6d36944202af83661c4d57c5394aeb4f2609fb48ef6a56ba78233188d12561d3` |
| `wake-lock.mp4` | `a27edba0e34b2648a90a800ae94fdef3e39016d1b9bd6e54a31ede1f1cddfed0` |
