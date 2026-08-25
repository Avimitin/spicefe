# Bitcount Single source record

spicefe uses Bitcount Single for the number printed on virtual card previews.

- Repository: `https://github.com/petrvanblokland/TYPETR-Bitcount`
- Revision: `89e7994f73b7f5ced80e7cf493d40be9e66ff82f`
- Source path: `fonts/ttf/variable/BitcountSingle[CRSV,ELSH,ELXP,slnt,wght].ttf`
- Source TTF SHA-256: `2247723922994c8e7fc51b984b633395ae85c7755c3cbf0dec0ca0b1dd49fabb`
- Generated WOFF2 SHA-256: `7cecb509e7dc6eb5ea7a4243a76747aee8681b35a0539a84ce491ed7685682cb`
- Pinned source Nix hash: `sha256-WENI7UDpxfG8g8akJyyEtWu3Rs4nuNX7nghchAuS75I=`

The repository is a non-flake input in `flake.nix`. The Nix build converts the
upstream variable TTF to WOFF2 with `woff2_compress` from the locked nixpkgs
revision `ffb3c9b700e759be2ef13237c9d8f953b32a1e46`, then byte-compares that
result with the checked-in browser asset. The conversion changes only the
container format; it does not subset the font or remove its variable axes.

CSS uses the upright weight-300 instance for card numbers and limits the web-font
range to spaces, digits, and uppercase hexadecimal letters. If the local asset
cannot load, the existing system monospace stack remains the fallback. No font
is requested from a third party at runtime.

Bitcount is licensed under the SIL Open Font License 1.1, Copyright 1980 The
Bitcount Project Authors. The normalized license and upstream FONTLOG are
included beside this record and verified against the pinned source by Nix.
