// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

// Astro builds the site into dist/ as static files; nothing of Astro's runs
// on a server. The prover is one Solid island, rendered in the browser alone
// (`client:only`), which runs linlog's WebAssembly module in a module worker.
// The module and the font its drawings are set in come from the flake's
// input `linlog' (modules/linlog.nix), linked at .cache/ by the dev shell and
// the sandbox alike, and imported through the aliases `linlog-web' and
// `linlog-fonts', so Vite names them by their content as it does every asset.
import { existsSync, realpathSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import solidJs from "@astrojs/solid-js";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

// The store paths behind the links, which the dev server must be allowed to
// serve; outside the dev shell or the sandbox a link may not exist yet.
const linked = (path: string) => (existsSync(here(path)) ? [realpathSync(here(path))] : []);

export default defineConfig({
  site: "https://linlog-prover.github.io",
  output: "static",
  build: {
    format: "directory",
    // All CSS from files, so that a style-src policy needs no exception for
    // stylesheets Astro would otherwise inline.
    inlineStylesheets: "never",
  },
  // The dev toolbar floats over the page and into every screenshot.
  devToolbar: { enabled: false },
  integrations: [solidJs()],
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        "linlog-web": here(".cache/linlog-web"),
        "linlog-fonts": here(".cache/linlog-fonts"),
      },
    },
    build: {
      // Nothing is inlined as a data: URI (a font or the module would be):
      // every asset is a file of its own.
      assetsInlineLimit: 0,
    },
    server: {
      fs: {
        allow: [
          here("."),
          ...linked(".cache/linlog-web"),
          ...linked(".cache/linlog-fonts"),
          // node_modules is a directory of links into the store, whose
          // fonts the stylesheets import.
          ...linked("node_modules/.bin").map(dirname),
        ],
      },
    },
    // The worker that runs linlog's module is an ES module worker, as the
    // page creates it (`type: "module"`).
    worker: { format: "es" },
  },
});
