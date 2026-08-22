# IBM Plex Sans source record

spicefe vendors four WOFF2 subsets from the official
[`IBM/plex`](https://github.com/IBM/plex) repository at the release tag
[`@ibm/plex-sans@1.1.0`](https://github.com/IBM/plex/releases/tag/%40ibm%2Fplex-sans%401.1.0),
peeled commit `1da12f02587b630c07e92692d21492d722f53614`:

- `IBMPlexSans-Regular-Latin1.woff2` — SHA-256 `b5ad7bd39f996144915f0ad9849a90183b27d8c28ad97ed98af5b1bebc51f6b1`
- `IBMPlexSans-Regular-Pi.woff2` — SHA-256 `1487059829a180f975627e473acc81ff22c2c0faf1da09b314c27eeb41b7f2e4`
- `IBMPlexSans-Medium-Latin1.woff2` — SHA-256 `b5610af04d0d4b5a14a621d96d974b993e945a065db1a8861918f69ef9321934`
- `IBMPlexSans-Medium-Pi.woff2` — SHA-256 `bf05f10c977353cfb5a5c11e8973adf77c2b93a4798da3aa0dd8ba5088e12515`

The `@font-face` declarations try the locally installed IBM Plex Sans faces
before these self-hosted files. Latin-1 and Pi are the only bundled subsets;
Chinese and other scripts use the reader's local fallback fonts. No font is
loaded from a CDN.

The unmodified files remain licensed under the SIL Open Font License 1.1.
See `LICENSE.OFL-1.1.txt` in this directory.
