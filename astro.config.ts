// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

// Astro builds the site into dist/ as static files; nothing of Astro's runs
// on a server. The prover is one Solid island, rendered in the browser alone
// (`client:only`), which runs linlog's WebAssembly module in a module worker.
// The module and the font its drawings are set in come from the flake's
// input `linlog' (modules/linlog.nix), linked at .cache/ by the dev shell and
// the sandbox alike, and imported through the aliases `linlog-web' and
// `linlog-fonts', so Vite names them by their content as it does every asset.
import { createHash } from "node:crypto";
import { existsSync, realpathSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import solidJs from "@astrojs/solid-js";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import { PREPAINT } from "./src/lib/theme";

/** A script's or style's hash as a CSP source names it. */
const sha256 = (text: string) =>
  `sha256-${createHash("sha256").update(text, "utf8").digest("base64")}` as const;

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
  // The Content-Security-Policy, as a <meta> element in every page's head:
  // GitHub Pages sets no response header, so the policy cannot be one, and
  // a <meta> policy cannot say frame-ancestors (the page can be framed).
  // Astro adds script-src and style-src with the hash of every inline script
  // and style it writes (the island's runtime); the pre-paint theme script is
  // `is:inline', which Astro leaves alone, so its hash is added here. The
  // `csp' flake check recomputes them from the built HTML. Nothing else
  // inline is allowed, and no `style' attribute (`no-style-attributes').
  // 'wasm-unsafe-eval' lets linlog's module compile; it runs in a worker,
  // which the page creates from its own origin, as it registers the service
  // worker (worker-src). connect-src is the font's and the worker's fetches.
  security: {
    csp: {
      directives: [
        "default-src 'none'",
        "img-src 'self'",
        "font-src 'self'",
        "connect-src 'self'",
        "worker-src 'self'",
        "manifest-src 'self'",
        "base-uri 'none'",
        "form-action 'none'",
      ],
      scriptDirective: {
        resources: ["'self'", "'wasm-unsafe-eval'"],
        hashes: [sha256(PREPAINT)],
      },
      styleDirective: { resources: ["'self'"] },
    },
  },
  // No code is highlighted: Shiki colours code with style attributes, which
  // the policy makes browsers ignore.
  markdown: { syntaxHighlight: false },
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
