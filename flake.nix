{
  description = "spicefe - a static browser client for the spice2x subscreen stream";

  inputs.bemaniIcons = {
    url = "github:bicarus-dev/bemani_fan_site_icons/225e494eebe3db5cd9b2ce04349b87606df97be3";
    flake = false;
  };
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  inputs.spice2xSource = {
    url = "github:spice2x/spice2x.github.io/b9c8afbbc12452edc3f4ac50cc1eda9ed0ee7f61";
    flake = false;
  };

  outputs = { self, bemaniIcons, nixpkgs, spice2xSource }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
      bemaniIconFiles = [
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
        in
        rec {
          default = pkgs.buildNpmPackage {
            pname = "spicefe";
            version = "0.1.0";
            src = self;
            npmDepsHash = "sha256-TspqtPorXU1xx9Ti+nfwPYaDxRfRENEWeZ+WC9xvhL0=";
            npmFlags = [ "--ignore-scripts" ];
            dontNpmBuild = true;
            installPhase = ''
              runHook preInstall
              cmp public/vendor/jmuxer.min.js node_modules/jmuxer/dist/jmuxer.min.js
              cmp public/vendor/jmuxer.LICENSE.txt node_modules/jmuxer/LICENSE
              cmp public/vendor/bemani-fan-site-icons/UPSTREAM_README.md ${bemaniIcons}/README.md
              cmp public/assets/spice2x.ico ${spice2xSource}/src/spice2x/build/icon.ico
              cmp public/vendor/spice2x/LICENSE.GPL-3.0.txt ${spice2xSource}/LICENSE
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
              pkgs.nodejs
              pkgs.python3
              pkgs.shellcheck
            ];
          };
        });

      formatter = forAllSystems (system:
        (import nixpkgs { inherit system; }).nixpkgs-fmt);
    };
}
