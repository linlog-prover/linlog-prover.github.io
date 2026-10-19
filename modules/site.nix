# linlog © Fabian Lukas Grubmüller 2026
# Licensed under the EUPL

# The site as static files: `nix build' runs `astro build' in the sandbox
# (node-modules.nix's npmTask) and puts the output at result/ -- plain HTML,
# CSS, JavaScript, the fonts and linlog's WebAssembly module, every page at
# <route>/index.html. This is what the e2e check serves, and what the
# deployment will publish.
{
  perSystem =
    { config, ... }:
    {
      packages.default = config.npmTask {
        name = "site";
        script = "npm run build";
        installPhase = "cp -r dist $out";
      };
    };
}
