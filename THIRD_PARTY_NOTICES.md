# Third-party notices

## spice2x/substream

Parts of the API transport, H.264 parsing, touch mapping, and lifecycle design
were adapted from `spice2x/substream`, revision
`8a6aa8474821e139bc4f6865cee1c270d6674730`.

The setup guide also reproduces the spicecfg screenshot referenced by the
upstream README at revision `a68cee2f2a4e730151331421eac3113db4b624e6`.
It is vendored as `public/assets/spicecfg-api-stream.png` with SHA-256
`a8a6dfc0d269e0e023359bc80ef0030a804918ef7239105552f9b4b340912772`.

BSD 3-Clause License

Copyright (c) 2026, spice2x

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its contributors
   may be used to endorse or promote products derived from this software
   without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

## jMuxer

The deployable site includes `jmuxer@2.1.1` from
[`webstream-labs/jmuxer`](https://github.com/webstream-labs/jmuxer). It is
licensed under the MIT License, Copyright (c) 2018 Samir Das. The complete
license ships with the browser asset as `public/vendor/jmuxer.LICENSE.txt`.

## Untitled UI React

The visual tokens and component treatment are adapted for the existing static
HTML/CSS application from the open-source
[`untitleduico/react`](https://github.com/untitleduico/react) design system,
revision `548c28ad9c9449bcc20751c84c542d5739f1e17e`. No Untitled UI PRO
assets or examples are included. The referenced source is licensed under the
MIT License, Copyright (c) 2025 Untitled UI. The complete license and source
record ship in `public/vendor/untitled-ui/`.

## IBM Plex Sans

The site self-hosts the unmodified Latin-1 and Pi WOFF2 subsets for IBM Plex
Sans Regular and Medium from
[`IBM/plex`](https://github.com/IBM/plex), release tag
`@ibm/plex-sans@1.1.0`, peeled commit
`1da12f02587b630c07e92692d21492d722f53614`. CSS checks for a locally
installed copy before requesting these assets. IBM Plex Sans is licensed under
the SIL Open Font License 1.1, Copyright © 2017 IBM Corp., with Reserved Font
Name "Plex". The complete license, hashes, and source record ship in
`public/vendor/ibm-plex-sans/`.

## Libre Caslon Text

The welcome headline uses Libre Caslon Text Regular from the official
[`impallari/Libre-Caslon-Text`](https://github.com/impallari/Libre-Caslon-Text)
repository. CSS checks for a locally installed copy before requesting the
self-hosted asset. Libre Caslon Text is licensed under the SIL Open Font
License 1.1, Copyright © 2012 Impallari Type. Its exact source and license are
pinned as a non-flake Nix input, and Nix reproducibly converts the source TTF
to the checked-in WOFF2. Hashes and provenance are recorded in
`public/vendor/libre-caslon-text/`.

## spice2x icon

The site icon and default connection-profile icon are copied without
modification from `spice2x/spice2x.github.io`, revision
`b9c8afbbc12452edc3f4ac50cc1eda9ed0ee7f61`, path
`src/spice2x/build/icon.ico`. The source repository is licensed under GPLv3.
The complete license and source record ship in `public/vendor/spice2x/`.

## e-amusement logo

Virtual card previews use the unmodified e-amusement logo retrieved from
KONAMI's `p.eagate.573.jp` service. e-amusement and its logo are marks of
KONAMI. Their inclusion is for visual identification of the card system and
does not imply endorsement. The exact source URL and checksum are recorded in
`public/vendor/e-amusement/SOURCE.md`.

## FrankerFaceZ Konmai emote

The lower-right mark on virtual card previews is FrankerFaceZ emote `146473`,
named `Konmai`, submitted by user `kbh_exe`. The CDN does not provide license
terms with the asset. It is included unmodified at the user's request; its
inclusion does not imply endorsement. The exact source URL, API metadata, and
checksum are recorded in `public/vendor/frankerfacez/SOURCE.md`.

## BEMANI fan-site icons

The optional connection-profile artwork is copied from
[`bicarus-dev/bemani_fan_site_icons`](https://github.com/bicarus-dev/bemani_fan_site_icons),
revision `225e494eebe3db5cd9b2ce04349b87606df97be3`. Only 11 browser-ready files
for known subscreen-capable releases are included: beatmania IIDX 27–33,
GITADORA GALAXY WAVE DELTA, SOUND VOLTEX 6–7, and pop'n music High Cheer. All
other upstream images and the redundant Windows ICO conversions are omitted.

At that revision, the upstream repository provides no license or other grant
of rights and says the images were gathered from the KONAMI BEMANI fan site.
The images and associated game names and marks may be owned by their respective
rights holders. Their inclusion is not an endorsement, and these notices do
not grant permission to use or redistribute them. See
`public/vendor/bemani-fan-site-icons/SOURCE.md` and `UPSTREAM_README.md` for
provenance.
