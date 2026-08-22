# spicefe

> [!WARNING]
> **Use only on a trusted LAN.** spice2x sends unauthenticated video over plain
> HTTP, its optional API password uses legacy RC4, and spicefe stores saved
> passwords as plain text in browser `localStorage`. HTTP compatibility mode
> can also be modified in transit. Prefer HTTPS mode when supported and deploy
> only reviewed artifacts through a static host you trust.

[简体中文](./README.zh-CN.md)

[![CI](https://github.com/Avimitin/spicefe/actions/workflows/ci.yml/badge.svg)](https://github.com/Avimitin/spicefe/actions/workflows/ci.yml)

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
- a first-run welcome/setup flow and a saved-server library on later visits or
  after disconnecting
- per-server control-API and video-stream indicators with separate failure
  details, plus a read-only API reachability check every five minutes while the
  server library is visible
- mouse, single-touch, and multi-touch input
- Fit, Fill, and Stretch display modes with correct touch coordinate mapping
- spice2x image-resize scene selection (Off and scenes 1–4)
- a dismissible in-stream adjustment bar, restorable from the top bar
- multiple named connection profiles in `localStorage`, each with a selectable
  game icon from categorized, subscreen-capable releases shown beside the PC
  name
- explicit Connect, Disconnect, and Switch behavior; a reload never reconnects
- English and Simplified Chinese UI with browser-language detection and a saved
  manual language choice
- disconnect immediately clears the final decoded frame and every playback
  backend
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
WebCodecs when available, with bursty decoder output coalesced to the newest
frame for each display refresh. Otherwise, the pinned pure-JavaScript jMuxer
package repackages Annex-B into fragmented MP4 in the client for MSE; it does
not transcode the video.

The saved-server page briefly opens the configured API WebSocket and sends the
same read-only `info/avs` query used when establishing a full session. It does
this when the list opens and every five minutes while the list remains visible;
it never opens a video stream for a reachability check. Any API response proves
the endpoint is reachable even when its authentication cannot be verified.

## Gaming PC setup

Install the [latest spice2x release](https://github.com/spice2x/spice2x.github.io/releases).
The minimum supported build is
[`spice2x-26-08-20`](https://github.com/spice2x/spice2x.github.io/releases/tag/26-08-20),
which introduced the required subscreen stream and CORS support. Then launch
the game with options equivalent to:

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
Build the downloadable ZIP, including the Windows local-server helper, with
`nix build .#release`.

### GitHub Actions

The [`CI` workflow](./.github/workflows/ci.yml) runs for pull requests and
pushes to `main`. It runs every flake check, builds the site, confirms that the
committed `public/` directory matches the Nix result, and uploads that result
as the seven-day `spicefe-public` artifact.

After a successful push to `main`, the workflow also uploads the same
dereferenced output as a GitHub Pages artifact and deploys it from a separate
job. Pull requests keep read-only permissions; only the deployment job receives
`pages: write` and `id-token: write`. The workflow never commits generated
files, so no generated `gh-pages` branch is needed.

The [`Release` workflow](./.github/workflows/release.yml) runs for every pushed
Git tag. It reruns the flake checks, builds the `release` package, and creates a
GitHub Release with a versioned ZIP, SHA-256 checksum, and generated release
notes. The archive is built entirely by Nix from the same site derivation used
for Pages. For example:

```sh
git tag v0.2.0
git push origin v0.2.0
```

If a release already exists for that tag, rerunning the workflow replaces its
two generated assets instead of creating a duplicate release.

To enable deployment, open **Settings → Pages** in the GitHub repository and
set **Source** to **GitHub Actions**. Configure a custom domain and leave
**Enforce HTTPS** disabled so its HTTP URL remains available for compatibility
mode. The default `github.io` address cannot provide that HTTP endpoint. If the
domain uses Cloudflare DNS, keep the record **DNS only** and do not enable HSTS
or an HTTPS redirect elsewhere in front of GitHub Pages.

GitHub Pages does not process `_headers`, so the custom response headers used
by Cloudflare Pages are not applied on this deployment target. This does not
change the direct-LAN connection design, but it provides less browser-policy
hardening than hosts that support those headers.

GitHub Actions and the official NixOS installer are pinned to complete commit
IDs. The installer executable is additionally pinned to Nix `2.35.1` and
verified against a repository-recorded SHA-256 before it runs.

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
[GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages),
[GitHub Pages HTTPS configuration](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https),
[EdgeOne direct upload](https://pages.edgeone.ai/document/direct-upload),
[EdgeOne HTTPS configuration](https://pages.edgeone.ai/document/https-configuration-overview),
[Cloudflare Pages headers](https://developers.cloudflare.com/pages/configuration/headers/),
and [Cloudflare Always Use HTTPS](https://developers.cloudflare.com/ssl/edge-certificates/additional-options/always-use-https/).

## Windows local HTTP server

Windows does not include a standalone `cmd.exe` web-server command, and IIS is
an optional system component that would be excessive for this use. Supported
Windows client versions do include Windows PowerShell 5.1, so the release ZIP
ships `serve.bat` and a small PowerShell static server built on .NET
`TcpListener`.

To serve spicefe directly from the gaming PC:

1. Download a release ZIP and its `.sha256` file, verify it, and extract the
   ZIP.
2. Double-click `serve.bat`. It listens on port `45000` and opens a local test
   page.
3. If Windows Firewall prompts, allow **Private networks** only.
4. On the phone or tablet, open one of the cyan LAN URLs printed in the server
   window, such as `http://192.168.1.50:45000/`.
5. Keep the window open while playing; press **Ctrl+C** to stop the server.

Run `serve.bat 8080` from Command Prompt to choose a different port. The helper
does not install a service, change firewall rules, require administrator
rights, or download anything. Its execution-policy override applies only to
that one PowerShell process. It is intentionally a trusted-LAN development
server, not an Internet-facing server.

The implementation relies on the Windows-included
[Windows PowerShell 5.1](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_windows_powershell_5.1?view=powershell-5.1)
and [.NET `TcpListener`](https://learn.microsoft.com/en-us/dotnet/api/system.net.sockets.tcplistener).

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

## Artwork provenance

The favicon and default profile artwork are the unmodified official spice2x
icon from pinned revision `b9c8afb`; its GPLv3 license ships with the site.
The searchable profile picker also includes an 11-image whitelist from
[`bicarus-dev/bemani_fan_site_icons`](https://github.com/bicarus-dev/bemani_fan_site_icons)
at pinned revision `225e494`: beatmania IIDX 27–33, GITADORA GALAXY WAVE
DELTA, SOUND VOLTEX 6–7, and pop'n music High Cheer. The picker groups those
icons by game, and the Nix build reconstructs the deployed icon directory from
the whitelist so no other upstream artwork is shipped.

The BEMANI icon repository provides no license and says the artwork was
gathered from the KONAMI BEMANI fan site. Operators must obtain any permission
required to redistribute or publicly serve those images. No affiliation with
or endorsement by KONAMI or the individual games is implied. Exact provenance
and the upstream README are included in
[`public/vendor/bemani-fan-site-icons/`](./public/vendor/bemani-fan-site-icons/).

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
reference client. The site identity uses the official spice2x icon, and the
optional game artwork comes from `bicarus-dev/bemani_fan_site_icons`. See
[THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) for licenses, revisions, and
the BEMANI artwork caveat.
