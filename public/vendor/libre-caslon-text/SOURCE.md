# Libre Caslon Text source record

spicefe vendors Libre Caslon Text Regular from the font's official repository:

- Repository: `https://github.com/impallari/Libre-Caslon-Text`
- Revision: `c31e21f7e8cf91f18d90f778ce20e66c68219c74`
- Source path: `fonts/TTF/LibreCaslonText-Regular.ttf`
- Source TTF SHA-256: `9f40a9afcbe33ef1f799e41683f4fd523c3a6bfb7c648d2404005f8d31c2fdf6`
- Generated WOFF2 SHA-256: `36070b5bcb14a439b8d3910f0179cb9a60c573f81a715aaec7644d86d45fe1ca`
- Pinned source Nix hash: `sha256-BRz21ixBWYaD+z84+BPa/UQHLnC2EnMDP+wxVHHan30=`

The repository is a non-flake input in `flake.nix`. The Nix build converts the
upstream TTF to WOFF2 with `woff2_compress` from the locked nixpkgs revision
`ffb3c9b700e759be2ef13237c9d8f953b32a1e46`, then byte-compares that result
with the checked-in browser asset. The conversion changes only the container
format; it does not subset or alter the font's glyphs.

The `@font-face` declaration checks for a locally installed Libre Caslon Text
copy first. The bundled font covers Latin text; Chinese uses the reader's local
serif fallback. No font is loaded from a third party at runtime.

Libre Caslon Text is licensed under the SIL Open Font License 1.1, Copyright
(c) 2012, Impallari Type. The license copy has only CRLF line endings and
trailing spaces normalized; the Nix build compares the normalized text with
the pinned upstream file.
