# React Aria source record

The production JavaScript bundle uses the following exact Apache-2.0-licensed
packages from Adobe's
[`react-spectrum`](https://github.com/adobe/react-spectrum) project:

- `react-aria-components@1.20.0`
- `react-aria@3.51.0`
- `react-stately@3.49.0`
- `@internationalized/date@3.12.3`
- `@internationalized/number@3.6.7`
- `@internationalized/string@3.2.10`

`package-lock.json` records each npm archive URL and SHA-512 integrity value.
Nix fetches those archives with lifecycle scripts disabled. The packages share
the complete Apache License 2.0 reproduced in
`LICENSE.Apache-2.0.txt`; the Nix build verifies it against every package.
