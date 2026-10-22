# linlog © Fabian Lukas Grubmüller 2026
# Licensed under the EUPL

# What the site takes from linlog, through the pinned flake input `linlog':
#
#   linlogWeb    the package `linlog-web' of linlog's flake: the library
#                compiled to wasm32 (linlog_web_bg.wasm), its JavaScript glue
#                and type declarations from the wasm-bindgen CLI, LICENSE and
#                THIRD-PARTY-NOTICES.txt, the Rust crates' notices. Built by
#                linlog's flake (and fetched from the Cachix cache
#                `linlog-prover' where its CI pushed it), never here.
#   linlogFonts  linlog's math fonts and their licences, every file of
#                linlog's cli/fonts/, where the prover keeps the fonts its
#                drawings are measured with: Euler Math (Euler-Math.otf,
#                OFL.txt), the font every drawing of the page is set in, and
#                STIX Two Math, Garamond-Math and Asana Math (each with its
#                <file>-OFL.txt), which an export may be set in; the bytes the
#                PNG and PDF exports render with. Taken from the input's
#                source at its pinned commit, never copied into this
#                repository.
#
# The dev shell and every npm task link the two at .cache/linlog-web and
# .cache/linlog-fonts, where astro.config.ts's aliases `linlog-web' and
# `linlog-fonts' point (devshell.nix, node-modules.nix).
{ inputs, lib, ... }:
{
  perSystem =
    { pkgs, system, ... }:
    {
      options = {
        linlogWeb = lib.mkOption {
          type = lib.types.package;
          default = inputs.linlog.packages.${system}.linlog-web;
          defaultText = lib.literalExpression "inputs.linlog.packages.\${system}.linlog-web";
          description = "linlog's WebAssembly bindings, the package the site's worker loads.";
        };

        linlogFonts = lib.mkOption {
          type = lib.types.package;
          default = pkgs.runCommand "linlog-fonts" { } ''
            mkdir $out
            cp ${inputs.linlog}/cli/fonts/*.otf ${inputs.linlog}/cli/fonts/*.txt $out/
          '';
          defaultText = lib.literalMD "linlog's math fonts and their licences from linlog's `cli/fonts/`";
          description = "The fonts linlog's drawings are set in, with their licences.";
        };
      };
    };
}
