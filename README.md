# spicefe

> [!WARNING]
> **Use only on a trusted LAN.** spice2x sends unauthenticated video over plain
> HTTP, its optional API password uses legacy RC4, and spicefe stores saved
> passwords as plain text in browser `localStorage`. HTTP compatibility mode
> can also be modified in transit. Prefer HTTPS mode when supported and deploy
> only reviewed artifacts through a static host you trust.

[简体中文](./README.zh-CN.md)

`spicefe` is a globally hostable, static LAN client for the spice2x subscreen
stream. Open the page on a phone, tablet, or another modern browser, select a
saved gaming PC, and the browser connects directly to spice2x for video, touch,
and resize control.

There is no relay and no companion web server to run on the gaming PC. The
static host only delivers this application; stream and input traffic stay on
the LAN.

## Version 0.1 scope

- H.264 video with WebCodecs first and a Media Source Extensions fallback
- automatic MJPEG fallback when H.264 is unavailable
- mouse, single-touch, and multi-touch input
- Fit, Fill, and Stretch display modes with correct touch coordinate mapping
- spice2x image-resize scene selection (Off and scenes 1–4)
- multiple named connection profiles in `localStorage`
- explicit Connect, Disconnect, and Switch behavior; a reload never reconnects
- responsive phone, tablet, and desktop UI

Audio, clipboard sharing, simultaneous subscreens, WAN relay, and legacy
browsers are intentionally outside this release.

## Data path

The API port entered in the UI is the spice2x base port:

| Purpose | Browser endpoint for API port 1337 | Protection |
| --- | --- | --- |
| Touch, resize, and game info | `ws://PC:1338` | Optional spice2x password; legacy RC4 |
| H.264 or MJPEG video | `http://PC:1339` | None |

The CDN never proxies either connection. H.264 is decoded directly with
WebCodecs when available. Otherwise, the pinned pure-JavaScript jMuxer package
repackages Annex-B into fragmented MP4 in the client for MSE; it does not
transcode the video.

## Gaming PC setup

Use a current spice2x build that includes `-apistream`, then launch the game
with options equivalent to:

```text
spice64.exe ... -api 1337 -apipass choose-a-lan-password -apistream
```

The password is optional, though recommended by spice2x. Permit inbound TCP to
ports 1338 and 1339 in Windows Firewall. The browser does not use the raw TCP
listener on 1337, but spice2x still requires `-api` to create the two adjacent
listeners.

On the client device, enter the PC's private IPv4 address when possible, such
as `192.168.1.50`. Both devices must be on the same LAN and client isolation
must be disabled on the Wi-Fi network.

## Browser connection modes

spice2x currently exposes only plain HTTP and WebSocket endpoints. That creates
an unavoidable browser-security boundary for a globally served page:

| Browser | Recommended page | What to do |
| --- | --- | --- |
| Current Chrome or Edge | HTTPS | Allow the Local Network Access prompt |
| Current Safari and WebKit-based iOS browsers | HTTP compatibility mode | Open HTTPS first, then use **Open HTTP mode** |
| Current Firefox | HTTP compatibility mode | Open HTTPS first, then use **Open HTTP mode** |

Chrome 142 introduced a secure-context Local Network Access permission that
can permit plain local requests and relax mixed-content blocking for them.
Other browser paths use the same static site over HTTP. The app moves the whole
profile library in a URL fragment between the two scheme-specific storage
origins and removes that fragment immediately after import. URL fragments are
not included in HTTP requests.

The deployment therefore must serve both HTTP and HTTPS without redirecting
all HTTP traffic to HTTPS. If a host forces the compatibility URL back to
HTTPS, the app detects the loop and explains the configuration problem.

Relevant platform references:

- [Chrome Local Network Access permission](https://developer.chrome.com/blog/local-network-access)
- [Chrome 142 release notes](https://developer.chrome.com/release-notes/142)
- [W3C Mixed Content](https://www.w3.org/TR/mixed-content/)
- [WebCodecs AVC registration](https://www.w3.org/TR/webcodecs-avc-codec-registration/)

## Deploying the static site

Run the full reproducibility and test gate first:

```sh
nix flake check
nix build
```

The deployable directory is `result/`. The committed `public/` directory is
also already complete and can be directly uploaded without a build step.

### EdgeOne Pages

Direct-upload `public/` (or the contents of `result/`). The included
`edgeone.json` applies the response headers. In the domain's HTTPS settings,
leave **Force HTTPS** disabled so `http://your-client-domain` remains usable.

### Cloudflare Pages

Use no framework and no build command, with `public` as the output directory.
The included `_headers` file is consumed by Pages. Use a custom domain and
disable **Always Use HTTPS** for that zone; do not enable HSTS on this client
hostname. The `pages.dev` hostname is not recommended for compatibility mode.

The deployment details referenced above are documented by
[EdgeOne direct upload](https://pages.edgeone.ai/document/direct-upload),
[EdgeOne HTTPS configuration](https://pages.edgeone.ai/document/https-configuration-overview),
[Cloudflare Pages headers](https://developers.cloudflare.com/pages/configuration/headers/),
and [Cloudflare Always Use HTTPS](https://developers.cloudflare.com/ssl/edge-certificates/additional-options/always-use-https/).

## Local development

The flake pins Nixpkgs and supplies Node.js and Python. No global npm install is
needed.

```sh
nix develop
npm test
python tools/check_static.py public
```

To serve the built site on the development machine:

```sh
nix run
```

It listens on `127.0.0.1:45000` by default. To expose it to another LAN device:

```sh
SPICEFE_BIND=0.0.0.0 SPICEFE_PORT=45000 nix run
```

## Dependency policy

The only browser dependency is `jmuxer@2.1.1`, a pure-JavaScript package with
no transitive dependencies. It is exact-version locked with npm integrity
metadata and has no install lifecycle scripts. The Nix build passes
`--ignore-scripts`, downloads the dependency through a fixed-output Nix
derivation, and byte-compares its distribution and license with the copies in
`public/vendor/` before producing the site. No executable npm binary is
downloaded or run.

## Security model

Use this only on a trusted home LAN:

- spice2x sends video in clear text and does not authenticate the stream port.
- Its optional API password uses RC4, which is legacy encryption rather than a
  modern secure channel.
- Profiles, including passwords, are intentionally stored as plain text in the
  browser's `localStorage` so they are ready after reopening the page.
- HTTP compatibility mode does not authenticate the static page in transit. A
  network attacker could replace its JavaScript, so prefer Chrome's HTTPS mode
  where it works and trust the network used for compatibility mode.
- A deployed static host controls executable code with access to the saved
  profile and LAN endpoints. Deploy from reviewed artifacts and use a host you
  trust.

There is no telemetry, remote account, service worker, or automatic connection
on page load.

## Acknowledgements

Protocol and client behavior were derived from the spice2x source tree and the
BSD-licensed [`spice2x/substream`](https://github.com/spice2x/substream)
reference client. See [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).
