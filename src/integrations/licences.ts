// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

/**
 * The licences served with the site, written into the build when it is done.
 *
 * - `/licenses/bundle.txt`: the notices of every npm package whose code is
 *   in the JavaScript sent to a browser, with each package's licence text,
 *   which Vite's `build.license` collects as it bundles (astro.config.ts
 *   names the file), and Astro's own, whose island runtime Astro writes
 *   into the pages themselves, where no bundle sees it. Vite lists modules,
 *   not assets, so the fonts are below.
 * - `/licenses/THIRD-PARTY-NOTICES.txt`: the notices of the Rust crates
 *   inside linlog's WebAssembly module, as linlog's flake collected them
 *   into the package `linlog-web`.
 * - `/licenses/LICENSE.txt`: the EUPL-1.2, the licence of linlog and of
 *   this site's code.
 * - `/fonts/<Family>-OFL.txt`: each font's licence beside its files, which
 *   astro.config.ts puts under /fonts/.
 *
 * A source that is missing fails the build. The `licences` flake check
 * reads the result apart from this code.
 */

import { appendFile, copyFile, mkdir, readdir, readFile } from "node:fs/promises";
import type { AstroIntegration } from "astro";

/** Where the site serves the licences of everything it sends. */
export const LICENCES = {
  bundle: "licenses/bundle.txt",
  crates: "licenses/THIRD-PARTY-NOTICES.txt",
  code: "licenses/LICENSE.txt",
} as const;

/** Each font family's files (by their name's start) and its licence's source, from the project's root. */
export const FONTS: readonly { family: string; files: string; licence: string }[] = [
  { family: "Euler-Math", files: "Euler-Math", licence: ".cache/linlog-fonts/OFL.txt" },
  {
    family: "STIXTwoMath",
    files: "STIXTwoMath-",
    licence: ".cache/linlog-fonts/STIXTwoMath-Regular-OFL.txt",
  },
  {
    family: "Garamond-Math",
    files: "Garamond-Math",
    licence: ".cache/linlog-fonts/Garamond-Math-OFL.txt",
  },
  { family: "Asana-Math", files: "Asana-Math", licence: ".cache/linlog-fonts/Asana-Math-OFL.txt" },
  {
    family: "Figtree",
    files: "figtree-",
    licence: "node_modules/@fontsource-variable/figtree/LICENSE",
  },
  {
    family: "SpaceMono",
    files: "space-mono-",
    licence: "node_modules/@fontsource/space-mono/LICENSE",
  },
];

/** The licence file served beside a family's fonts. */
export const fontLicence = (family: string) => `fonts/${family}-OFL.txt`;

export function licences(): AstroIntegration {
  return {
    name: "licences",
    hooks: {
      "astro:build:done": async ({ dir, logger }) => {
        const root = new URL("../../", import.meta.url);
        await mkdir(new URL("licenses/", dir), { recursive: true });
        await copyFile(
          new URL(".cache/linlog-web/THIRD-PARTY-NOTICES.txt", root),
          new URL(LICENCES.crates, dir),
        );
        await copyFile(new URL("LICENSE", root), new URL(LICENCES.code, dir));
        const astro = JSON.parse(
          await readFile(new URL("node_modules/astro/package.json", root), "utf8"),
        );
        const text = await readFile(new URL("node_modules/astro/LICENSE", root), "utf8");
        // In the form of Vite's own entries.
        await appendFile(
          new URL(LICENCES.bundle, dir),
          `\n## astro - ${astro.version} (${astro.license})\n\n${text.trim()}\n`,
        );
        const fonts = await readdir(new URL("fonts/", dir));
        for (const font of FONTS) {
          if (!fonts.some((file) => file.startsWith(font.files))) {
            throw new Error(`no file of ${font.family} under /fonts/, where its licence goes`);
          }
          await copyFile(new URL(font.licence, root), new URL(fontLicence(font.family), dir));
        }
        logger.info(`the licences of the bundle, the crates and ${FONTS.length} fonts are served`);
      },
    },
  };
}
