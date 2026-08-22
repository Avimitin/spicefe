{
  description = "spicefe - a static browser client for the spice2x subscreen stream";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { self, nixpkgs }:
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
              nativeBuildInputs = [ pkgs.nodejs pkgs.python3 ];
            }
            ''
              cp -R ${self} source
              chmod -R u+w source
              cd source
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
            packages = [ pkgs.nodejs pkgs.python3 ];
          };
        });

      formatter = forAllSystems (system:
        (import nixpkgs { inherit system; }).nixpkgs-fmt);
    };
}
