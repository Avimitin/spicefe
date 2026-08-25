{
  description = "spicefe - a static browser client for the spice2x subscreen stream";

  inputs.bemaniIcons = {
    url = "github:bicarus-dev/bemani_fan_site_icons/225e494eebe3db5cd9b2ce04349b87606df97be3";
    flake = false;
  };
  inputs.bitcountSingle = {
    url = "github:petrvanblokland/TYPETR-Bitcount/89e7994f73b7f5ced80e7cf493d40be9e66ff82f";
    flake = false;
  };
  inputs.libreCaslonText = {
    url = "github:impallari/Libre-Caslon-Text/c31e21f7e8cf91f18d90f778ce20e66c68219c74";
    flake = false;
  };
  inputs.sixteenFont = {
    url = "github:StuffJackMakes/Sixteen-Font/84cf1630b762243f70faa243bf2d3c03073dc2ce";
    flake = false;
  };
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  inputs.spice2xSource = {
    url = "github:spice2x/spice2x.github.io/b9c8afbbc12452edc3f4ac50cc1eda9ed0ee7f61";
    flake = false;
  };

  outputs = { self, bemaniIcons, bitcountSingle, libreCaslonText, nixpkgs, sixteenFont, spice2xSource }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
      bemaniIconFiles = [
        "ac_IIDX18.png"
        "ac_IIDX19.png"
        "ac_IIDX20.png"
        "ac_iidx21.png"
        "ac_IIDX22.png"
        "ac_IIDX23.png"
        "ac_IIDX23_pre.png"
        "ac_IIDX24.png"
        "ac_iidx24_loc.png"
        "ac_iidx25.png"
        "ac_iidx26.png"
        "ac_iidx27.png"
        "ac_iidx28.png"
        "ac_iidx29.png"
        "ac_iidx30.png"
        "ac_iidx31.png"
        "ac_iidx32.png"
        "ac_iidx33.png"
        "ac_gitadora_gw_delta.png"
        "ac_sdvx6.png"
        "ac_sdvx7.jpg"
        "ac_popn_highcheers.jpg"
      ];
    in
    {
      packages = forAllSystems (system:
        let
          pkgs = import nixpkgs { inherit system; };
          ibmPlexBase = "https://raw.githubusercontent.com/IBM/plex/1da12f02587b630c07e92692d21492d722f53614/packages/plex-sans";
          ibmPlexRegularLatin1 = pkgs.fetchurl {
            url = "${ibmPlexBase}/fonts/split/woff2/IBMPlexSans-Regular-Latin1.woff2";
            hash = "sha256-ta1705+ZYUSRXwrZhJqQGDsn2MKK2X7ZivWxvrxR9rE=";
          };
          ibmPlexRegularPi = pkgs.fetchurl {
            url = "${ibmPlexBase}/fonts/split/woff2/IBMPlexSans-Regular-Pi.woff2";
            hash = "sha256-FIcFmCmhgPl1Yn5HOsyB/yLCwPrx2gmzFMJ+60G38uQ=";
          };
          ibmPlexMediumLatin1 = pkgs.fetchurl {
            url = "${ibmPlexBase}/fonts/split/woff2/IBMPlexSans-Medium-Latin1.woff2";
            hash = "sha256-tWEK8E0NS1oUpiHZbZdLmT6UWgZdsaiGGRj2nvkyGTQ=";
          };
          ibmPlexMediumPi = pkgs.fetchurl {
            url = "${ibmPlexBase}/fonts/split/woff2/IBMPlexSans-Medium-Pi.woff2";
            hash = "sha256-vwXxDJdzU8+1pcEeiXOt93wrk6R5jaOqDdi6UIjhJRU=";
          };
          ibmPlexLicense = pkgs.fetchurl {
            url = "${ibmPlexBase}/LICENSE.txt";
            hash = "sha256-fmsoGO29j2oBroBkHMjxalEIDQj7TlMr46C290rbB9o=";
          };
          eaLogo = pkgs.fetchurl {
            url = "https://p.eagate.573.jp/img/ea_logo.png";
            hash = "sha256-IvrpVqcKkOq9OxFM4sIdSqnF7gaub79LmZlyNkClzdU=";
          };
          konmaiLogo = pkgs.fetchurl {
            url = "https://cdn.frankerfacez.com/emoticon/146473/4";
            hash = "sha256-1XqOwNQkfQcucl0Rjj08nCN5jvQFhh1QwVnpPcpWjLg=";
          };
          brushedMetalTexture = pkgs.fetchurl {
            url = "https://www.wallart.com/media/catalog/product/cache/871f459736130e239a3f5e6472128962/w/1/w12098-small.jpg";
            hash = "sha256-yG44KpRWo4de9Em4myVCjRpJaMiN+e//T7eOJnAkS5g=";
          };
          libreCaslonTextRegularWoff2 = pkgs.runCommand "LibreCaslonText-Regular.woff2"
            {
              nativeBuildInputs = [ pkgs.woff2 ];
            }
            ''
              cp ${libreCaslonText}/fonts/TTF/LibreCaslonText-Regular.ttf LibreCaslonText-Regular.ttf
              chmod u+w LibreCaslonText-Regular.ttf
              woff2_compress LibreCaslonText-Regular.ttf
              install -m 0444 LibreCaslonText-Regular.woff2 "$out"
            '';
          bitcountSingleVariableWoff2 = pkgs.runCommand "BitcountSingle-Variable.woff2"
            {
              nativeBuildInputs = [ pkgs.woff2 ];
            }
            ''
              cp "${bitcountSingle}/fonts/ttf/variable/BitcountSingle[CRSV,ELSH,ELXP,slnt,wght].ttf" BitcountSingle-Variable.ttf
              chmod u+w BitcountSingle-Variable.ttf
              woff2_compress BitcountSingle-Variable.ttf
              install -m 0444 BitcountSingle-Variable.woff2 "$out"
            '';
          sixteenMonoWoff2 = pkgs.runCommand "Sixteen-Mono.woff2" { }
            ''
              install -m 0444 ${sixteenFont}/public/woff2/Sixteen-Mono.woff2 "$out"
            '';
        in
        rec {
          default = pkgs.buildNpmPackage {
            pname = "spicefe";
            version = "0.1.2";
            src = self;
            npmDepsHash = "sha256-aBUIDjhEy4nqftEVhAFOoTV5/nPqezBuwKWexdeg8oc=";
            npmFlags = [ "--ignore-scripts" ];
            nativeBuildInputs = [
              pkgs.esbuild
              pkgs.typescript
            ];
            installPhase = ''
              runHook preInstall
              cmp public/vendor/jmuxer.min.js node_modules/jmuxer/dist/jmuxer.min.js
              cmp public/vendor/jmuxer.LICENSE.txt node_modules/jmuxer/LICENSE
              cmp public/vendor/qrcode-generator/qrcode.js node_modules/qrcode-generator/dist/qrcode.mjs
              grep -Fx '  "version": "2.0.4",' node_modules/qrcode-generator/package.json
              grep -Fx '  "license": "MIT",' node_modules/qrcode-generator/package.json
              grep -Fx 'Copyright (c) 2009 Kazuhiko Arase' public/vendor/qrcode-generator/LICENSE.MIT.txt
              grep -Fx '  "version": "19.2.8",' node_modules/react/package.json
              grep -Fx '  "version": "19.2.8",' node_modules/react-dom/package.json
              grep -Fx '  "version": "0.27.0",' node_modules/scheduler/package.json
              cmp public/vendor/react/LICENSE.MIT.txt node_modules/react/LICENSE
              cmp public/vendor/react/LICENSE.MIT.txt node_modules/react-dom/LICENSE
              cmp public/vendor/react/LICENSE.MIT.txt node_modules/scheduler/LICENSE
              cmp public/vendor/bemani-fan-site-icons/UPSTREAM_README.md ${bemaniIcons}/README.md
              cmp public/assets/spice2x.ico ${spice2xSource}/src/spice2x/build/icon.ico
              cmp public/vendor/spice2x/LICENSE.GPL-3.0.txt ${spice2xSource}/LICENSE
              cmp public/vendor/ibm-plex-sans/fonts/IBMPlexSans-Regular-Latin1.woff2 ${ibmPlexRegularLatin1}
              cmp public/vendor/ibm-plex-sans/fonts/IBMPlexSans-Regular-Pi.woff2 ${ibmPlexRegularPi}
              cmp public/vendor/ibm-plex-sans/fonts/IBMPlexSans-Medium-Latin1.woff2 ${ibmPlexMediumLatin1}
              cmp public/vendor/ibm-plex-sans/fonts/IBMPlexSans-Medium-Pi.woff2 ${ibmPlexMediumPi}
              cmp public/vendor/libre-caslon-text/fonts/LibreCaslonText-Regular.woff2 ${libreCaslonTextRegularWoff2}
              cmp public/vendor/bitcount-single/fonts/BitcountSingle-Variable.woff2 ${bitcountSingleVariableWoff2}
              cmp public/vendor/sixteen-font/fonts/Sixteen-Mono.woff2 ${sixteenMonoWoff2}
              # Upstream's license file accidentally omits the initial C in Copyright.
              cmp \
                <(awk '{ for (i = 1; i <= NF; i++) print $i }' \
                  public/vendor/sixteen-font/LICENSE.OFL-1.1.txt) \
                <(sed '1s/^opyright/Copyright/' ${sixteenFont}/Sixteen-LICENSE.txt \
                  | awk '{ for (i = 1; i <= NF; i++) print $i }')
              cmp public/vendor/e-amusement/ea_logo.png ${eaLogo}
              cmp public/vendor/frankerfacez/konmai.png ${konmaiLogo}
              cmp public/vendor/brushed-metal/w12098-small.jpg ${brushedMetalTexture}
              cmp \
                <(sed 's/\r$//; s/[[:blank:]]*$//' public/vendor/libre-caslon-text/LICENSE.OFL-1.1.txt) \
                <(sed 's/\r$//; s/[[:blank:]]*$//' ${libreCaslonText}/OFL.txt)
              cmp \
                <(sed 's/\r$//; s/[[:blank:]]*$//' public/vendor/bitcount-single/LICENSE.OFL-1.1.txt) \
                <(sed 's/\r$//; s/[[:blank:]]*$//' ${bitcountSingle}/OFL.txt)
              cmp \
                <(sed 's/\r$//; s/[[:blank:]]*$//' public/vendor/bitcount-single/FONTLOG.md) \
                <(sed 's/\r$//; s/[[:blank:]]*$//' ${bitcountSingle}/FONTLOG.md)
              cmp \
                <(tr -s '[:space:]' '\n' < public/vendor/ibm-plex-sans/LICENSE.OFL-1.1.txt) \
                <(tr -s '[:space:]' '\n' < ${ibmPlexLicense})
              cmp LICENSE public/LICENSE.txt
              cmp THIRD_PARTY_NOTICES.md public/THIRD_PARTY_NOTICES.md
              mkdir -p "$out"
              cp -R public/. "$out/"
              rm -r "$out/vendor/bemani-fan-site-icons/img"
              mkdir -p "$out/vendor/bemani-fan-site-icons/img"
              for icon_file in ${pkgs.lib.escapeShellArgs bemaniIconFiles}; do
                install -m 0444 \
                  "${bemaniIcons}/img/$icon_file" \
                  "$out/vendor/bemani-fan-site-icons/img/$icon_file"
              done
              diff --brief --recursive public "$out"
              runHook postInstall
            '';
          };

          libre-caslon-text-regular = libreCaslonTextRegularWoff2;

          bitcount-single-variable = bitcountSingleVariableWoff2;

          iidx-segment-display = sixteenMonoWoff2;

          release = pkgs.runCommand "spicefe-public.zip"
            {
              nativeBuildInputs = [
                pkgs.coreutils
                pkgs.findutils
                pkgs.zip
              ];
            }
            ''
              mkdir staging
              cp -R ${default}/. staging/
              install -m 0444 ${self}/serve.bat staging/serve.bat
              install -m 0444 ${self}/serve.ps1 staging/serve.ps1

              # Stable timestamps and sorted input make repeated builds byte-identical.
              find staging -exec touch -h -d '@315532800' {} +
              cd staging
              find . -type f -printf '%P\n' \
                | LC_ALL=C sort \
                | zip -X -q "$out" -@
            '';
        });

      apps = forAllSystems (system:
        let
          pkgs = import nixpkgs { inherit system; };
          site = self.packages.${system}.default;
          serve = pkgs.writeShellApplication {
            name = "spicefe-serve";
            runtimeInputs = [ pkgs.python3 ];
            text = ''
              bind="''${SPICEFE_BIND:-127.0.0.1}"
              port="''${SPICEFE_PORT:-45000}"
              exec python -m http.server --bind "$bind" --directory ${site} "$port"
            '';
          };
        in
        {
          default = {
            type = "app";
            program = "${serve}/bin/spicefe-serve";
            meta.description = "Serve spicefe locally";
          };
          serve = {
            type = "app";
            program = "${serve}/bin/spicefe-serve";
            meta.description = "Serve spicefe locally";
          };
          github-cli = {
            type = "app";
            program = "${pkgs.gh}/bin/gh";
            meta.description = "Run the pinned GitHub CLI";
          };
        });

      checks = forAllSystems (system:
        let
          pkgs = import nixpkgs { inherit system; };
        in
        {
          package = self.packages.${system}.default;
          release = self.packages.${system}.release;
          static = pkgs.runCommand "spicefe-checks"
            {
              nativeBuildInputs = [
                pkgs.actionlint
                pkgs.nodejs
                pkgs.powershell
                pkgs.python3
                pkgs.shellcheck
              ];
            }
            ''
              cp -R ${self} source
              chmod -R u+w source
              cd source
              actionlint .github/workflows/*.yml
              node --test tests/*.test.mjs
              python tools/check_static.py public
              pwsh -NoLogo -NoProfile -Command '
                $tokens = $null
                $parseErrors = $null
                [System.Management.Automation.Language.Parser]::ParseFile(
                  (Resolve-Path "serve.ps1"),
                  [ref]$tokens,
                  [ref]$parseErrors
                ) > $null
                if ($parseErrors.Count -gt 0) {
                  $parseErrors | ForEach-Object { Write-Error $_.Message }
                  exit 1
                }
              '
              touch "$out"
            '';
        });

      devShells = forAllSystems (system:
        let
          pkgs = import nixpkgs { inherit system; };
        in
        {
          default = pkgs.mkShellNoCC {
            packages = [
              pkgs.actionlint
              pkgs.esbuild
              pkgs.nodejs
              pkgs.python3
              pkgs.shellcheck
              pkgs.typescript
            ];
          };
        });

      formatter = forAllSystems (system:
        (import nixpkgs { inherit system; }).nixpkgs-fmt);
    };
}
