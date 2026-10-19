// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

/**
 * Offline and installable: what the build writes once every other file of
 * the site is there.
 *
 * - `/icons/<name>.png`: the manifest's icons, drawn from public/icon.svg by
 *   linlog's own renderer (its WebAssembly module, run here in Node), at the
 *   192 and 512 pixels Chromium asks for, and a maskable one that fills its
 *   square to the edge.
 * - `/manifest.webmanifest`: the web app manifest, linked by every page
 *   (layouts/Base.astro), with the panel's colour of tokens.css.
 * - `/sw.js`: the service worker (src/offline/sw.js) with the list of every
 *   file of the site and a hash of their contents filled in.
 *
 * Nothing is written at /linlog, linlog's own Pages site on the same origin
 * (the `pages-paths` check), and the worker leaves that path alone.
 */

import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";
import { panelColors } from "../lib/colors";
// Through the alias the config gives the site's own code; read when the
// config loads, since its module runner is closed when the build is done.
import { initSync, render } from "linlog-web/linlog_web.js";

/** The manifest's icons: the two sizes Chromium's install criteria ask for, and a maskable one. */
export const ICONS = [
  { name: "192", size: 192, purpose: "any" },
  { name: "512", size: 512, purpose: "any" },
  { name: "maskable-512", size: 512, purpose: "maskable" },
] as const;

/** Every file under a directory, by its path from there with forward slashes. */
async function files(dir: URL): Promise<string[]> {
  const base = fileURLToPath(dir);
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((e) => e.isFile())
    .map((e) => relative(base, join(e.parentPath, e.name)).split(sep).join("/"))
    .sort();
}

export function offline(): AstroIntegration {
  return {
    name: "offline",
    hooks: {
      "astro:build:done": async ({ dir, logger }) => {
        const root = new URL("../../", import.meta.url);
        initSync({ module: await readFile(new URL(".cache/linlog-web/linlog_web_bg.wasm", root)) });
        const icon = await readFile(new URL("public/icon.svg", root), "utf8");
        const font = await readFile(new URL(".cache/linlog-fonts/Euler-Math.otf", root));
        await mkdir(new URL("icons/", dir), { recursive: true });
        for (const { name, size, purpose } of ICONS) {
          // A maskable icon is cut to the launcher's shape: no rounded corners of its own.
          const svg = (purpose === "maskable" ? icon.replace(/ rx="\d+"/, "") : icon).replace(
            "<svg ",
            `<svg width="${size}" height="${size}" `,
          );
          const png = render(svg, "png", font, JSON.stringify({ styles: { png: { scale: 1 } } }));
          await writeFile(new URL(`icons/${name}.png`, dir), png);
        }

        const colors = panelColors(await readFile(new URL("src/styles/tokens.css", root), "utf8"));
        const manifest = {
          name: "linlog",
          short_name: "linlog",
          description: "Prove sequents of linear logic step by step, in the browser.",
          id: "/",
          start_url: "/",
          scope: "/",
          display: "standalone",
          background_color: colors.dark,
          theme_color: colors.dark,
          icons: ICONS.map(({ name, size, purpose }) => ({
            src: `/icons/${name}.png`,
            sizes: `${size}x${size}`,
            type: "image/png",
            purpose,
          })),
        };
        await writeFile(
          new URL("manifest.webmanifest", dir),
          `${JSON.stringify(manifest, null, 2)}\n`,
        );

        // The site's files as the worker asks for them: the page at /, the rest by its path.
        const paths = (await files(dir)).filter((path) => path !== "sw.js");
        const hash = createHash("sha256");
        for (const path of paths) {
          hash.update(path).update(await readFile(new URL(path, dir)));
        }
        const urls = paths.map((path) => (path === "index.html" ? "/" : `/${path}`));
        if (urls.some((url) => url === "/linlog" || url.startsWith("/linlog/"))) {
          throw new Error("a file at /linlog, linlog's own Pages site");
        }
        const source = await readFile(new URL("src/offline/sw.js", root), "utf8");
        if (!source.includes("const FILES = [];") || !source.includes('const VERSION = "";')) {
          throw new Error(
            "src/offline/sw.js: the lines FILES and VERSION are filled from are gone",
          );
        }
        const worker = source
          .replace("const FILES = [];", `const FILES = ${JSON.stringify(urls)};`)
          .replace('const VERSION = "";', `const VERSION = "${hash.digest("hex").slice(0, 16)}";`);
        await writeFile(new URL("sw.js", dir), worker);
        logger.info(`the service worker caches ${urls.length} files; the manifest has its icons`);
      },
    },
  };
}
