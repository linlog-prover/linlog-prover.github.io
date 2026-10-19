# linlog © Fabian Lukas Grubmüller 2026
# Licensed under the EUPL

# The development shell (`numtide/devshell'), entered automatically by direnv
# through .envrc, or by hand with `nix develop'. `menu' lists the commands.
#
# Every tool the repo uses comes from here: jj (the VCS; `up' and the Claude
# Code hooks shell out to it), python3 (the hooks' interpreter), Node.js
# (node-modules.nix's `nodejs'), Biome, the TypeScript language server for
# Claude Code, and, from treefmt.nix, the configured treefmt. The npm
# packages' own binaries (astro, vitest, playwright) come through
# node_modules/.bin. Playwright's browsers come from playwright.nix.
#
# On entry the shell links node_modules from the store
# (`packages.node-modules') into ./node_modules -- one symlink per entry, so
# the directory itself stays writable for Vite's and Astro's caches -- and
# linlog's bindings and fonts at .cache/linlog-web and .cache/linlog-fonts
# (linlog.nix), each held by a garbage collector's root so that a collection
# cannot pull it from under the links. The scheme is the author's learning
# sites' (website-learn's modules/devshell.nix).
#
# Nix reads the flake source through the git index, and only a jj command
# writes it, so `check' snapshots the working copy first: a file created a
# moment ago is otherwise missing from the build. Command names avoid shell
# builtins, which win over PATH (`test' in bash and zsh, `run' and `watch' in
# nushell), hence `tests'.
{ inputs, ... }:
{
  imports = [ inputs.devshell.flakeModule ];

  perSystem =
    { config, pkgs, ... }:
    let
      nodeModules = "${config.packages.node-modules}/node_modules";
    in
    {
      devshells.default = {
        devshell.packages = [
          pkgs.jujutsu
          pkgs.python3
          config.nodejs
          pkgs.biome
          # Claude Code's typescript-lsp plugin runs this from the PATH Claude
          # Code started with; it takes TypeScript from ./node_modules.
          pkgs.typescript-language-server
        ];

        # `nix develop' sets PRJ_ROOT to the directory it is run from, which
        # need not be the project's: from a subdirectory, the linking below
        # would make a second node_modules there. It is corrected first, to
        # the nearest directory up holding flake.nix.
        devshell.startup.prj-root.text = ''
          root=$PRJ_ROOT
          while [ "$root" != / ] && [ ! -e "$root/flake.nix" ]; do root=''${root%/*}; root=''${root:-/}; done
          [ -e "$root/flake.nix" ] && export PRJ_ROOT=$root
        '';

        devshell.startup.node-modules.deps = [ "prj-root" ];
        devshell.startup.node-modules.text = ''
          nm="$PRJ_ROOT/node_modules"
          mkdir -p "$nm" "$PRJ_ROOT/.cache"
          nix-store --add-root "$PRJ_ROOT/.cache/node-modules" --realise ${config.packages.node-modules} >/dev/null \
            || echo "could not root node_modules at .cache/node-modules" >&2
          for entry in ${nodeModules}/* ${nodeModules}/.[!.]*; do
            [ -e "$entry" ] || continue
            link="$nm/''${entry##*/}"
            if [ -e "$link" ] && [ ! -L "$link" ]; then
              echo "node_modules/''${entry##*/} is not a link into the store; leaving it alone" >&2
              continue
            fi
            ln -sfn "$entry" "$link"
          done
          for link in "$nm"/* "$nm"/.[!.]*; do
            [ -L "$link" ] || continue
            case "$(readlink "$link")" in
              ${nodeModules}/*) ;;
              ${builtins.storeDir}/*) rm "$link" ;;
            esac
          done
        '';

        # The bindings and the fonts, where astro.config.ts's aliases look.
        # `nix-store --add-root' makes the link itself the root.
        devshell.startup.linlog.deps = [ "prj-root" ];
        devshell.startup.linlog.text = ''
          mkdir -p "$PRJ_ROOT/.cache"
          nix-store --add-root "$PRJ_ROOT/.cache/linlog-web" --realise ${config.linlogWeb} >/dev/null \
            || echo "could not link linlog-web at .cache/linlog-web" >&2
          nix-store --add-root "$PRJ_ROOT/.cache/linlog-fonts" --realise ${config.linlogFonts} >/dev/null \
            || echo "could not link the fonts at .cache/linlog-fonts" >&2
        '';

        env = [
          {
            name = "PATH";
            prefix = "${nodeModules}/.bin";
          }
          {
            name = "ASTRO_TELEMETRY_DISABLED";
            value = "1";
          }
        ];

        commands = [
          {
            category = "develop";
            name = "dev";
            help = "astro dev: the site on http://localhost:4321 with hot reload";
            command = ''cd "$PRJ_ROOT" && exec astro dev "$@"'';
          }
          {
            category = "verify";
            name = "tests";
            help = "vitest: the unit tests (a file or -t NAME narrows them)";
            command = ''cd "$PRJ_ROOT" && exec vitest run "$@"'';
          }
          {
            category = "verify";
            name = "lint";
            help = "biome lint, then astro check (TypeScript over .ts, .tsx and .astro)";
            command = ''cd "$PRJ_ROOT" && biome lint --error-on-warnings && astro check'';
          }
          {
            category = "verify";
            name = "e2e";
            help = "playwright: browser tests against a fresh `astro build` (a file narrows them)";
            # The host's LD_LIBRARY_PATH (an audio library built against a
            # newer glibc) breaks nixpkgs' Chromium, so it is dropped.
            command = ''cd "$PRJ_ROOT" && exec env -u LD_LIBRARY_PATH playwright test "$@"'';
          }
          {
            category = "verify";
            name = "check";
            help = "Snapshot the working copy so nix sees new files, then run every flake check";
            command = ''
              jj util snapshot >/dev/null 2>&1 || true
              nix flake check "$@"
            '';
          }
          {
            category = "maintain";
            name = "up";
            help = "Update this flake and commit the lock file (jj)";
            # `nix flake update --commit-lock-file' makes a *git* commit, which
            # bypasses jj; the update is done jj-natively instead, with nix's
            # commit message. The update procedure (every ecosystem at its
            # latest release at least fourteen days old, verified by the
            # checks first) is the CLAUDE.md's.
            command = ''
              set -eu
              isolated=0
              if [ -n "$(jj diff -r @ --name-only)" ] || \
                 [ -n "$(jj log --no-graph -r @ -T description)" ]; then
                jj new
                isolated=1
              fi
              err=$(mktemp)
              trap 'rm -f "$err"' EXIT
              if ! nix flake update 2>"$err"; then
                cat "$err" >&2
                if [ "$isolated" = 1 ]; then jj abandon; fi
                exit 1
              fi
              cat "$err" >&2
              if [ -z "$(jj diff -r @ --name-only)" ]; then
                echo "flake.lock is already up to date; nothing to commit."
                if [ "$isolated" = 1 ]; then jj abandon; fi
                exit 0
              fi
              updates=$(awk '/^•/{p=1} p' "$err")
              if [ -n "$updates" ]; then
                msg="flake.lock: Update

              Flake lock file updates:

              $updates"
              else
                msg="flake.lock: Update"
              fi
              jj commit -m "$msg"
            '';
          }
        ];
      };
    };
}
