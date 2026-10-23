// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

/**
 * Offline and installable: what the build writes once every other file of
 * the site is there.
 *
 * - `/logo/`: the logo, its SVGs (src/logo/, with their licence) and the
 *   rasters the flake draws from them (modules/logo.nix, linked at
 *   .cache/linlog-logo): the favicon's PNG fallback, the Apple touch icon,
 *   the link preview's image, and the manifest's icons at the 192 and 512
 *   pixels Chromium asks for, with a maskable one that fills its square to
 *   the edge.
 * - `/manifest.webmanifest`: the web app manifest, linked by every page
 *   (layouts/Base.astro), with the panel's colour of tokens.css.
 * - `/sw.js`: the service worker (src/offline/sw.js) with the list of every
 *   file of the site and a hash of their contents filled in.
 *
 * Nothing is written at /linlog, linlog's own Pages site on the same origin
 * (the `pages-paths` check), and the worker leaves that path alone.
 */

import { createHash } from "node:crypto";
import { copyFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";
import { panelColors } from "../lib/colors";

/** The manifest's icons under /logo/: the two sizes Chromium's install criteria ask for, and a maskable one. */
export const ICONS = [
  { name: "icon-192", size: 192, purpose: "any" },
  { name: "icon-512", size: 512, purpose: "any" },
  { name: "icon-maskable-512", size: 512, purpose: "maskable" },
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
        await mkdir(new URL("logo/", dir), { recursive: true });
        for (const from of ["src/logo/", ".cache/linlog-logo/site/"]) {
          for (const name of await readdir(new URL(from, root))) {
            await copyFile(new URL(name, new URL(from, root)), new URL(`logo/${name}`, dir));
          }
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
            src: `/logo/${name}.png`,
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
        // linlog's math fonts but Euler Math: fetched when a visitor chooses one.
        const later = urls.filter((url) =>
          /^\/fonts\/(STIXTwoMath-Regular|Garamond-Math|Asana-Math|NewCMMath-Book)\.[^/]*\.otf$/.test(
            url,
          ),
        );
        if (urls.some((url) => url === "/linlog" || url.startsWith("/linlog/"))) {
          throw new Error("a file at /linlog, linlog's own Pages site");
        }
        const source = await readFile(new URL("src/offline/sw.js", root), "utf8");
        if (
          !source.includes("const FILES = [];") ||
          !source.includes("const LATER = [];") ||
          !source.includes('const VERSION = "";')
        ) {
          throw new Error(
            "src/offline/sw.js: the lines FILES, LATER and VERSION are filled from are gone",
          );
        }
        const worker = source
          .replace(
            "const FILES = [];",
            `const FILES = ${JSON.stringify(urls.filter((url) => !later.includes(url)))};`,
          )
          .replace("const LATER = [];", `const LATER = ${JSON.stringify(later)};`)
          .replace('const VERSION = "";', `const VERSION = "${hash.digest("hex").slice(0, 16)}";`);
        await writeFile(new URL("sw.js", dir), worker);
        if (later.length !== 4) throw new Error(`${later.length} math fonts to fetch later, not 4`);
        logger.info(
          `the service worker caches ${urls.length - later.length} files, and ${later.length} fonts when chosen; the manifest has its icons`,
        );
      },
    },
  };
}
