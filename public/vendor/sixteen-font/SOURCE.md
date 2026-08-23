# Sixteen font source

- Work: **Sixteen**, monospaced regular face
- Creator: **Jack Sivak**
- Homepage and demonstration: <https://stuffjackmakes.com/sixteen-font/>
- Source repository: <https://github.com/StuffJackMakes/Sixteen-Font>
- Pinned revision: `84cf1630b762243f70faa243bf2d3c03073dc2ce`
- Upstream archive: `Sixteen.tar.gz`, 76,206 bytes
- Archive SHA-256: `f6db4a347e3b0c4fbeb6262d75bc3e75d9ec93c27a9b08c0460f3e8864ae3bcd`
- Upstream file: `public/woff2/Sixteen-Mono.woff2`
- Browser asset: `fonts/Sixteen-Mono.woff2`, 2,924 bytes
- Browser-asset SHA-256: `90422372ee699848e22fd31a01373167ba74d425a6f39164745c046a29e7c9fa`
- Retrieved: 2026-08-23

The checked-in WOFF2 is the unmodified Sixteen by Jack Sivak browser font.
The source repository is pinned as a non-flake Nix input, and the Nix build
verifies the browser asset byte for byte.

Sixteen assigns the semicolon (`U+003B`) to an all-segments-on glyph and the
degree sign (`U+00B0`) to an invisible, full-width glyph. spicefe follows the
author's demonstrated stacking technique: nine dim all-on glyphs sit beneath
the active text, while spaces are presented with the full-width all-off glyph.

Sixteen is licensed under the SIL Open Font License 1.1, Copyright © 2020 Jack
Sivak, with Reserved Font Name "Sixteen". The complete license is included as
`LICENSE.OFL-1.1.txt`. The pinned upstream license file accidentally omits the
initial `C` in `Copyright`; the bundled copy corrects only that typographical
omission, and the Nix check verifies the remainder after whitespace
normalization.

The font remains separately licensed under the OFL and is not covered by
spicefe's MIT license.
