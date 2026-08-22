# Alfa Slab One source record

spicefe vendors the Latin WOFF2 subset of Alfa Slab One Regular published by
the official Google Fonts service:

- Family page: `https://fonts.google.com/specimen/Alfa+Slab+One`
- CSS release path: `https://fonts.gstatic.com/s/alfaslabone/v21/6NUQ8FmMKwSEKjnm5-4v-4Jh2dJhew.woff2`
- Font SHA-256: `48a110c7fda81f9921a6437e1a813dcea56df5a9f52f778c7b2f2151e36e4f2c`
- Font Nix hash: `sha256-SKEQx/2oH5khpkN+GoE9zqVt9an1L3eMey8hUeNuTyw=`

The license and family metadata come from the official `google/fonts`
repository at revision `ec626514f79f831f1ab848a82114a0ce7e2d6372`:

- Directory: `ofl/alfaslabone/`
- Upstream `OFL.txt` SHA-256: `e315abc82a78710c7242e2f2e6529651fd631d4d50e6ad98ea194f9b54c3d701`
- Normalized `LICENSE.OFL-1.1.txt` SHA-256: `6cb8a5e3f60a5b23d1e5fff9b6fa860f0e5d4055a67bb262497c1e8d8fc13b05`
- `METADATA.pb` SHA-256: `030e8934909865802313487b8b6ae342e79a06c102ff740efa6cfdb5b26cb97c`

The `@font-face` declaration tries a locally installed Alfa Slab One first.
Only the Latin subset is bundled; Chinese uses the reader's local serif
fallback. No font is loaded from Google at runtime.

The font and metadata are unmodified. The license copy has only CRLF line
endings and trailing spaces normalized; the Nix build compares the normalized
text with the pinned upstream file. The SIL Open Font License 1.1 names the
Reserved Font Name "Alfa Slab" and ships beside this record.
