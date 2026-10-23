# linlog © Fabian Lukas Grubmüller 2026
# Licensed under the EUPL

# linlog's logo, drawn: every raster of it, made from its SVGs under
# src/logo/ (the one source, CC BY 4.0, src/logo/LICENSE.txt) by
# modules/_logo/derive.py with nixpkgs' resvg, never by hand:
#
#   site/    favicon-32.png, apple-touch-icon.png (180), icon-192.png,
#            icon-512.png and icon-maskable-512.png (the manifest's), og.png
#            (1200 by 630, the link preview's image), which the build copies
#            to /logo/ beside the SVGs (src/integrations/offline.ts);
#   github/  avatar.png (512) and social-preview.png (1280 by 640), which only
#            the author can set, in GitHub's web interface.
#
# `nix build .#logo' builds it; the dev shell and every npm task link it at
# .cache/linlog-logo (devshell.nix, node-modules.nix).
{ lib, ... }:
{
  perSystem =
    { config, pkgs, ... }:
    {
      options.logoFiles = lib.mkOption {
        type = lib.types.package;
        default =
          pkgs.runCommand "linlog-logo"
            {
              nativeBuildInputs = [
                pkgs.python3
                pkgs.resvg
              ];
            }
            ''
              python3 ${./_logo/derive.py} ${
                lib.fileset.toSource {
                  root = ../src/logo;
                  fileset = lib.fileset.fileFilter (f: f.hasExt "svg") ../src/logo;
                }
              } $out
            '';
        defaultText = lib.literalMD "the rasters `modules/_logo/derive.py` draws from `src/logo/`";
        description = "The logo's rasters, drawn from its SVGs: `site/` for the site, `github/` for the author.";
      };

      config.packages.logo = config.logoFiles;
    };
}
