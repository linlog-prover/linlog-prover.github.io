// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

/**
 * The pictograms' library, checked when the build starts: Lucide's Solid
 * package, `lucide-solid`, must be the version package.json pins, under the
 * ISC licence the site's notices name, and a binding of the Solid the site
 * runs: its `solid` export condition (its JSX source, which the build
 * compiles with the site's own Solid) present, and its peer range of
 * `solid-js` met by the installed version. A package that drifts from any
 * of these fails the build.
 */

import { readFile } from "node:fs/promises";
import type { AstroIntegration } from "astro";

/** What the check reads of a package.json. */
export interface Manifest {
  readonly name?: string;
  readonly version?: string;
  readonly license?: string;
  readonly dependencies?: Record<string, string>;
  readonly peerDependencies?: Record<string, string>;
  readonly exports?: Record<string, unknown>;
}

/** Whether a version meets a caret range of npm's form (`^1.4.7`), the form Lucide's peer range takes. */
export function meetsCaret(version: string, range: string): boolean {
  const want = /^\^(\d+)\.(\d+)\.(\d+)$/.exec(range.trim());
  const have = /^(\d+)\.(\d+)\.(\d+)$/.exec(version.trim());
  if (!want || !have) return false;
  const [w, h] = [want.slice(1).map(Number), have.slice(1).map(Number)] as [number[], number[]];
  if (h[0] !== w[0]) return false;
  for (let i = 1; i < 3; i++) {
    if ((h[i] as number) !== (w[i] as number)) return (h[i] as number) > (w[i] as number);
  }
  return true;
}

/** The problems of the site's Lucide, or none. */
export function lucideProblems(site: Manifest, lucide: Manifest, solid: Manifest): string[] {
  const problems: string[] = [];
  const pinned = site.dependencies?.["lucide-solid"];
  if (lucide.version !== pinned) {
    problems.push(`lucide-solid is ${lucide.version}, but package.json pins ${pinned}`);
  }
  if (lucide.license !== "ISC")
    problems.push(`lucide-solid's licence is ${lucide.license}, not ISC`);
  const root = lucide.exports?.["."] as Record<string, unknown> | undefined;
  if (typeof root?.["solid"] !== "string") {
    problems.push("lucide-solid has no `solid` export condition: no Solid source to compile");
  }
  const range = lucide.peerDependencies?.["solid-js"];
  if (!range || !solid.version || !meetsCaret(solid.version, range)) {
    problems.push(`solid-js ${solid.version} does not meet lucide-solid's peer range ${range}`);
  }
  return problems;
}

export function lucide(): AstroIntegration {
  return {
    name: "lucide",
    hooks: {
      "astro:build:start": async ({ logger }) => {
        const root = new URL("../../", import.meta.url);
        const read = async (path: string): Promise<Manifest> =>
          JSON.parse(await readFile(new URL(path, root), "utf8"));
        const problems = lucideProblems(
          await read("package.json"),
          await read("node_modules/lucide-solid/package.json"),
          await read("node_modules/solid-js/package.json"),
        );
        if (problems.length) throw new Error(problems.join("; "));
        logger.info(
          "lucide-solid is the pinned version, ISC, and a binding of the installed Solid",
        );
      },
    },
  };
}
