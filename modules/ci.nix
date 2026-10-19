# linlog © Fabian Lukas Grubmüller 2026
# Licensed under the EUPL

# Everything CI must find in the Nix store for a run to avoid redoing work,
# collected into one derivation that a single `nix build' roots (the CI
# workflow builds it after the checks). `nix build' roots only the runtime
# closure of what it builds, and almost everything expensive here is a
# build-time input of something else: node_modules, Node.js and Chromium are
# inputs of the site and the checks, whose own outputs are a directory of
# HTML or an empty file. The author's sites' scheme (website-learn's
# modules/ci.nix).
{ lib, ... }:
{
  perSystem =
    { config, pkgs, ... }:
    {
      packages.ci-cache = pkgs.linkFarmFromDrvs "ci-cache" (
        lib.unique (
          [
            config.packages.default
            config.packages.node-modules
            config.playwrightBrowsers
            config.linlogWeb
            pkgs.stdenvNoCC
            config.formatter
            pkgs.python3
          ]
          ++ lib.concatMap (check: check.nativeBuildInputs or [ ]) (lib.attrValues config.checks)
          ++ lib.attrValues config.checks
        )
      );
    };
}
