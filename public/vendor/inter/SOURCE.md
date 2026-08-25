# Inter source record

spicefe uses Inter Bold for names printed on virtual card previews.

- Repository: `https://github.com/rsms/inter`
- Release: `4.1`
- Release archive: `https://github.com/rsms/inter/releases/download/v4.1/Inter-4.1.zip`
- Source path: `web/Inter-Bold.woff2`
- WOFF2 SHA-256: `fa888127b6da015b65569f0351f3b5c391ad928904951f1c20e9f8462a8d95ea`
- Pinned Nixpkgs revision: `ffb3c9b700e759be2ef13237c9d8f953b32a1e46`

The checked-in WOFF2 is copied without modification from the Inter 4.1 release
selected by the locked Nixpkgs `inter` package. The Nix build asserts that
version and byte-compares both the font and license with the pinned source.
CSS tries a locally installed Inter Bold face before requesting the self-hosted
asset. No font is requested from a third party at runtime.

Inter is licensed under the SIL Open Font License 1.1, Copyright (c) 2016 The
Inter Project Authors. The complete upstream license is included beside this
record.
