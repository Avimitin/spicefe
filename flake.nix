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
    in
    {
      packages = forAllSystems (system:
        let
          pkgs = import nixpkgs { inherit system; };
        in
        {
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
              diff --brief --recursive public/vendor/bemani-fan-site-icons/img ${bemaniIcons}/img
              cmp public/vendor/bemani-fan-site-icons/UPSTREAM_README.md ${bemaniIcons}/README.md
              cmp public/assets/spice2x.ico ${spice2xSource}/src/spice2x/build/icon.ico
              cmp public/vendor/spice2x/LICENSE.GPL-3.0.txt ${spice2xSource}/LICENSE
              cmp LICENSE public/LICENSE.txt
              cmp THIRD_PARTY_NOTICES.md public/THIRD_PARTY_NOTICES.md
              mkdir -p "$out"
              cp -R public/. "$out/"
              runHook postInstall
            '';
          };
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
        });

      checks = forAllSystems (system:
        let
          pkgs = import nixpkgs { inherit system; };
        in
        {
          package = self.packages.${system}.default;
          static = pkgs.runCommand "spicefe-checks"
            {
              nativeBuildInputs = [
                pkgs.actionlint
                pkgs.nodejs
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
