# linlog © Fabian Lukas Grubmüller 2026
# Licensed under the EUPL

# What `nix flake check' covers beyond the `treefmt' check treefmt-nix adds
# on its own, `claude-hooks' (claude-hooks.nix) and `playwright-version'
# (playwright.nix). Each check is also a target of its own:
# `nix build --no-link .#checks.x86_64-linux.<name>'. Each reads only its own
# files (`lib.fileset'), so a change reruns only the checks it can affect.
#
#   site        the site builds (flake-parts does not turn packages into
#               checks by itself)
#   unit        Vitest: the client's logic under src/ (src/**/*.test.ts) --
#               the link's codec, the step tree and its replay, the worker
#               protocol -- some of it against linlog's real module in Node
#   typecheck   astro check: TypeScript over .ts, .tsx and .astro
#   lint        biome lint, from biome.json
#   e2e         Playwright in nixpkgs' Chromium (playwright.nix) against
#               packages.default, the site exactly as it is published,
#               served by tests/serve.ts: one test per interaction of the
#               island, at desktop and phone widths
#   no-style-attributes
#               no `style' attribute in the built HTML: a style-src policy
#               without 'unsafe-inline' makes browsers ignore them (the
#               author's sites' rule); the island places things through the
#               CSSOM, which no policy restricts
#   csp         every page carries the Content-Security-Policy as a <meta>
#               element first in its head, allowing each inline script and
#               style by a hash recomputed here apart from Astro, with
#               'wasm-unsafe-eval' and nothing that allows inline code
#               wholesale; no data: URL (modules/_checks/csp.py)
#   licences    the site serves the licence of everything it sends: the npm
#               bundle's notices (Vite's build.license) naming every run-time
#               dependency at its locked version, linlog-web's
#               THIRD-PARTY-NOTICES.txt and the code's LICENSE byte for byte,
#               each font beside its OFL text, every image the logo's under
#               logo/ beside its CC BY 4.0 notice, and CC BY 4.0 on every page
#               of written content (modules/_checks/licences.py)
#   problems    the store of problems (src/content/problems/) against linlog's
#               command at the pinned input: every verdict and fragment the
#               command's, every provable problem with a session of its
#               sequent that `proof' accepts, no unprovable one with a session
#               (modules/_checks/problems.py)
#   pages-paths the site as Pages publishes it: a 404.html at its root, and
#               nothing at /linlog or under it, where linlog's own Pages
#               site (the rustdoc) lives on the same address
#   licence-headers
#               every source file starts with the project's licence header
#               in its comment syntax
#   actionlint  the CI workflow is valid, its shell steps through shellcheck
#   deadnix     no unused nix bindings or arguments
{
  perSystem =
    {
      config,
      lib,
      pkgs,
      ...
    }:
    let
      inherit (config) fileSets;

      # The code under src/, tests included.
      src = lib.fileset.unions [
        fileSets.npm
        ../src
      ];

      # Biome enables a rule domain when package.json depends on its library;
      # without the manifest the sandbox would lint with fewer rules than the
      # dev shell.
      biomeSources = lib.fileset.toSource {
        root = ../.;
        fileset = lib.fileset.unions [
          ../biome.json
          ../package.json
          ../tsconfig.json
          (lib.fileset.intersection
            (lib.fileset.unions [
              ../src
              ../tests
            ])
            (
              lib.fileset.fileFilter (
                f:
                lib.any f.hasExt [
                  "ts"
                  "tsx"
                  "json"
                  "css"
                  "astro"
                ]
              ) ../.
            )
          )
          ../astro.config.ts
          ../vitest.config.ts
          ../playwright.config.ts
        ];
      };

      # The source files that carry the licence header, by extension, and
      # the comment it is written in.
      headerSources = lib.fileset.toSource {
        root = ../.;
        fileset = lib.fileset.fileFilter (
          f:
          lib.any f.hasExt [
            "nix"
            "ts"
            "tsx"
            "astro"
            "css"
            "sh"
            "py"
            "yml"
            "yaml"
          ]
          || f.name == ".envrc"
        ) ../.;
      };

      noStyleAttributes = pkgs.writeText "check-no-style-attributes.py" ''
        import html.parser, pathlib, sys


        class Finder(html.parser.HTMLParser):
            def __init__(self):
                super().__init__()
                self.found = []

            def handle_starttag(self, tag, attrs):
                if any(name == "style" for name, _ in attrs):
                    self.found.append(f"<{tag} style={dict(attrs)['style']!r}>")

            handle_startendtag = handle_starttag


        site = pathlib.Path(sys.argv[1])
        files = sorted([*site.rglob("*.html"), *site.rglob("*.svg")])
        bad = []
        for path in files:
            finder = Finder()
            finder.feed(path.read_text())
            finder.close()
            bad += [f"{path.relative_to(site)}: {tag}" for tag in finder.found]

        if bad:
            sys.exit("style attributes, which a style-src policy makes browsers ignore:\n" + "\n".join(bad))
        print(f"no style attribute in the {len(files)} HTML and SVG files")
      '';

      pagesPaths = pkgs.writeText "check-pages-paths.py" ''
        import pathlib, sys

        site = pathlib.Path(sys.argv[1])
        problems = []
        if not (site / "404.html").is_file():
            problems.append("no 404.html at the site's root, which Pages serves for a missing path")
        # Paths are matched as Pages matches them, case and all: /linlog is
        # linlog's project site, which a file of this one must never shadow.
        taken = sorted(str(p.relative_to(site)) for p in site.iterdir() if p.name.split(".")[0] == "linlog")
        if taken:
            problems.append("the site has paths at /linlog, linlog's own Pages site: " + ", ".join(taken))
        if problems:
            sys.exit("\n".join(problems))
        print("404.html is at the root, and nothing is at /linlog")
      '';

      licenceHeaders = pkgs.writeText "check-licence-headers.py" ''
        import pathlib, sys

        FIRST = "linlog © Fabian Lukas Grubmüller 2026"
        SECOND = "Licensed under the EUPL"
        COMMENT = {".nix": "#", ".sh": "#", ".py": "#", ".yml": "#", ".yaml": "#",
                   ".ts": "//", ".tsx": "//", ".astro": "//", ".css": "/*"}

        root = pathlib.Path(sys.argv[1])
        bad = []
        files = sorted(p for p in root.rglob("*") if p.is_file())
        for path in files:
            lines = path.read_text().splitlines()
            # A shebang, shellcheck's shell directive or an Astro component's
            # frontmatter fence comes first.
            while lines and (lines[0].startswith("#!") or lines[0].startswith("# shellcheck") or lines[0] == "---"):
                lines = lines[1:]
            mark = "#" if path.name == ".envrc" else COMMENT[path.suffix]
            if mark == "/*":
                ok = len(lines) >= 2 and lines[0] == f"/* {FIRST}" and lines[1] == f"   {SECOND} */"
            else:
                ok = lines[:2] == [f"{mark} {FIRST}", f"{mark} {SECOND}"]
            if not ok:
                bad.append(str(path.relative_to(root)))

        if bad:
            sys.exit("no licence header at the top of:\n" + "\n".join(bad))
        print(f"the licence header heads all {len(files)} source files")
      '';

      onBuild =
        name: script:
        pkgs.runCommand "check-${name}" { } ''
          ${pkgs.python3}/bin/python3 ${script} ${config.packages.default}
          touch $out
        '';

      # Without a fontconfig, headless Chromium in the sandbox renders no
      # text and may close mid-test.
      fontconfig = pkgs.makeFontsConf { fontDirectories = [ pkgs.dejavu_fonts ]; };
    in
    {
      checks =
        lib.mapAttrs onBuild {
          no-style-attributes = noStyleAttributes;
          pages-paths = pagesPaths;
          csp = ./_checks/csp.py;
        }
        // {
          site = config.packages.default;

          unit = config.npmTask {
            name = "unit";
            script = "npm test";
            sources = src;
            files = [ ../vitest.config.ts ];
          };

          typecheck = config.npmTask {
            name = "typecheck";
            script = "npm run typecheck";
            sources = lib.fileset.unions [
              src
              ../astro.config.ts
              ../tests
              ../vitest.config.ts
              ../playwright.config.ts
            ];
          };

          e2e = config.npmTask {
            name = "e2e";
            # A failed run prints each failed test's error context (the page as
            # Playwright last saw it), since the sandbox keeps no test-results.
            script = ''
              export HOME=$TMPDIR
              npm run e2e -- --workers=$(( NIX_BUILD_CORES > 4 ? 4 : NIX_BUILD_CORES )) || {
                for f in test-results/*/error-context.md; do
                  [ -e "$f" ] && { echo "== $f"; cat "$f"; }
                done
                exit 1
              }
            '';
            sources = lib.fileset.unions [
              fileSets.npm
              ../playwright.config.ts
              ../tests
            ];
            env = {
              CI = "1";
              SITE_DIR = config.packages.default;
              PLAYWRIGHT_BROWSERS_PATH = config.playwrightBrowsers;
              PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = "1";
              PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = "true";
              FONTCONFIG_FILE = fontconfig;
            };
          };

          lint = pkgs.runCommand "check-lint" { nativeBuildInputs = [ pkgs.biome ]; } ''
            cd ${biomeSources}
            biome lint --error-on-warnings
            touch $out
          '';

          licences = pkgs.runCommand "check-licences" { } ''
            ${pkgs.python3}/bin/python3 ${./_checks/licences.py} ${config.packages.default} \
              ${config.linlogWeb} ${config.linlogFonts} ${../package.json} ${../package-lock.json} ${../LICENSE}
            touch $out
          '';

          problems = pkgs.runCommand "check-problems" { } ''
            ${pkgs.python3}/bin/python3 ${./_checks/problems.py} ${../src/content/problems} \
              ${config.linlogCli}/bin/linlog
            touch $out
          '';

          licence-headers = pkgs.runCommand "check-licence-headers" { } ''
            ${pkgs.python3}/bin/python3 ${licenceHeaders} ${headerSources}
            touch $out
          '';

          actionlint =
            pkgs.runCommand "check-actionlint"
              {
                nativeBuildInputs = [
                  pkgs.actionlint
                  pkgs.shellcheck
                ];
              }
              ''
                cd ${../.github/workflows}
                actionlint -shellcheck=shellcheck *.yml
                touch $out
              '';

          deadnix =
            pkgs.runCommand "check-deadnix"
              {
                nativeBuildInputs = [ pkgs.deadnix ];
                src = lib.fileset.toSource {
                  root = ../.;
                  fileset = lib.fileset.fileFilter (f: f.hasExt "nix") ../.;
                };
              }
              ''
                cd $src
                deadnix --fail .
                touch $out
              '';
        };
    };
}
