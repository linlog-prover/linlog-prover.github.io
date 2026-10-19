# linlog © Fabian Lukas Grubmüller 2026
# Licensed under the EUPL

# node_modules, built by nix from package-lock.json, and the machinery every
# other module uses to run an npm script against it. Taken from the author's
# learning sites (website-learn's modules/node-modules.nix), with this site's
# `fileSets'.
#
# npm resolves; nix installs. `npm install <pkg>' only rewrites package.json
# and package-lock.json (.npmrc sets package-lock-only), and nixpkgs'
# importNpmLock fetches every locked package by the integrity hash already in
# the lock -- so there is no npmDepsHash to keep in step, and a lock change
# is the whole of a dependency change. The devshell links the result into
# ./node_modules (devshell.nix); direnv rebuilds it when the lock moves.
#
# Packages for another platform are dropped before fetching. The lock lists
# every prebuilt binary of esbuild, rolldown, lightningcss and Tailwind's
# oxide for win32, freebsd, musl, s390x, ...; importNpmLock would otherwise
# download all of them for npm to skip at install time. Without `resolved'
# an entry is not fetched, and npm skips an optional package for another
# platform without needing it.
#
# `npmTask' runs an npm command over some of the project's files in the
# sandbox with node_modules linked in, and linlog's bindings and fonts linked
# at .cache/ as the dev shell links them (linlog.nix): the shape shared by the
# site build (site.nix) and the checks that need Node.js (checks.nix).
# `fileSets' names those files by who reads them, so that each derivation
# copies only what it reads and a change reruns only what reads it.
{
  perSystem =
    {
      config,
      lib,
      pkgs,
      ...
    }:
    let
      inherit (pkgs.stdenv) hostPlatform;

      package = lib.importJSON ../package.json;
      lock = lib.importJSON ../package-lock.json;

      # npm's names for this platform, as package-lock.json's os/cpu/libc
      # fields spell them.
      npmPlatform = {
        os =
          {
            linux = "linux";
            darwin = "darwin";
          }
          .${hostPlatform.parsed.kernel.name};
        cpu =
          {
            x86_64 = "x64";
            aarch64 = "arm64";
          }
          .${hostPlatform.parsed.cpu.name};
        libc = if hostPlatform.isMusl then "musl" else "glibc";
      };

      # npm's rule for one field: a `!name' entry excludes, and a list with any
      # positive entries admits only those.
      admits =
        field: module:
        let
          spec = module.${field} or [ ];
          value = npmPlatform.${field};
          denied = map (lib.removePrefix "!") (builtins.filter (lib.hasPrefix "!") spec);
          allowed = builtins.filter (e: !lib.hasPrefix "!" e) spec;
        in
        !(builtins.elem value denied) && (allowed == [ ] || builtins.elem value allowed);

      foreign =
        module:
        (module.optional or false)
        && !(builtins.all (field: admits field module) [
          "os"
          "cpu"
          "libc"
        ]);

      packageLock = lock // {
        packages = lib.mapAttrs (
          _: module:
          if foreign module then
            removeAttrs module [
              "resolved"
              "integrity"
            ]
          else
            module
        ) lock.packages;
      };

      fileSets = rec {
        # What every npm script reads besides its own files.
        npm = lib.fileset.unions [
          ../package.json
          ../package-lock.json
          ../tsconfig.json
        ];
        # What the site build reads: the sources but their tests, and the
        # public files. The tests, the CI workflow, .claude/ and the notes stay
        # out, so editing them rebuilds nothing.
        site = lib.fileset.unions [
          npm
          ../astro.config.ts
          (lib.fileset.difference ../src (lib.fileset.fileFilter (f: lib.hasSuffix ".test.ts" f.name) ../src))
          ../public
        ];
      };
    in
    {
      options = {
        nodejs = lib.mkOption {
          type = lib.types.package;
          default = pkgs.nodejs_24;
          defaultText = lib.literalExpression "pkgs.nodejs_24";
          description = "The Node.js that installs node_modules and runs every npm script.";
        };

        fileSets = lib.mkOption {
          type = lib.types.lazyAttrsOf lib.types.raw;
          readOnly = true;
          default = fileSets;
          defaultText = lib.literalMD "the file sets of `modules/node-modules.nix`";
          description = "The repository's files by who reads them, as `lib.fileset` values: `npm` and `site`.";
        };

        npmTask = lib.mkOption {
          type = lib.types.functionTo lib.types.package;
          readOnly = true;
          description = ''
            `{ name, script, sources ? fileSets.site, files ? [ ], installPhase ? "touch $out", nativeBuildInputs ? [ ], env ? { } }`
            to a derivation that runs `script` in a copy of `sources` (the
            site's, unless a check reads less) plus `files` (paths or
            filesets), with node_modules linked from `packages.node-modules`
            and linlog's bindings and fonts at .cache/.
          '';
        };
      };

      config = {
        packages.node-modules = pkgs.importNpmLock.buildNodeModules {
          inherit package packageLock;
          inherit (config) nodejs;
        };

        npmTask =
          {
            name,
            script,
            sources ? fileSets.site,
            files ? [ ],
            installPhase ? "touch $out",
            nativeBuildInputs ? [ ],
            env ? { },
          }:
          pkgs.stdenvNoCC.mkDerivation {
            pname = "${package.name}-${name}";
            inherit (package) version;
            src = lib.fileset.toSource {
              root = ../.;
              fileset = lib.fileset.unions ([ sources ] ++ files);
            };

            # importNpmLock's hook links each entry of node_modules from the
            # store into a real ./node_modules, which Vite and Astro can then
            # write their caches into.
            nativeBuildInputs = [
              config.nodejs
              pkgs.importNpmLock.hooks.linkNodeModulesHook
            ]
            ++ nativeBuildInputs;
            npmDeps = config.packages.node-modules;

            env = {
              ASTRO_TELEMETRY_DISABLED = "1";
            }
            // env;

            buildPhase = ''
              runHook preBuild
              mkdir -p .cache
              ln -s ${config.linlogWeb} .cache/linlog-web
              ln -s ${config.linlogFonts} .cache/linlog-fonts
              ${script}
              runHook postBuild
            '';

            installPhase = ''
              runHook preInstall
              ${installPhase}
              runHook postInstall
            '';
          };
      };
    };
}
