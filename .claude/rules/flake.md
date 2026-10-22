---
paths:
  - "flake.nix"
  - "flake.lock"
  - "modules/**"
  - "package.json"
  - ".npmrc"
  - ".envrc"
---

# The flake and the npm dependencies

Dendritic flake-parts: `flake.nix` holds the inputs plus
`mkFlake { inherit inputs; } (inputs.import-tree ./modules)`. Every `.nix` file under
`modules/` is one concern and is found automatically, so never add an imports list. Each
module opens with a comment saying what it does and why; keep it true when editing.
Modules share values through options (`nodejs`, `npmTask`, `fileSets` in
`node-modules.nix`; `linlogWeb`, `linlogFonts` in `linlog.nix`; `playwrightBrowsers`),
never through `specialArgs`. The scheme is the author's learning sites'
(`~/Projects/own/website-learn/modules/`); take a fix from there rather than reinventing it.

- **linlog is an input, never built here.** `linlog.nix` takes the package `linlog-web`
  and every file of `cli/fonts/` (the four math fonts and their licences) from it. nixpkgs follows
  linlog's (`nixpkgs.follows = "linlog/nixpkgs"`): one package set for the bindings and the
  site, so an update of linlog moves both, and Node.js and playwright-driver are whatever
  linlog's nixpkgs has. While a change of linlog is under way, build against the workspace
  with `--override-input linlog path:/home/tux/Projects/own/linlog-…`; the committed lock
  only ever names a commit on linlog's `main`.
- **The bindings and fonts reach the site through `.cache/`**: the dev shell links
  `.cache/linlog-web` and `.cache/linlog-fonts` (each a garbage collector's root), and
  `npmTask` links the same in the sandbox; `astro.config.ts`, `vitest.config.ts` and
  `tsconfig.json` alias `linlog-web` and `linlog-fonts` to them.
- **Every derivation reads only its files** (`lib.fileset`): `fileSets.site` is what
  `astro build` reads; a check adds its own. A new file that the build or a check reads
  must be in one, or the sandbox does not see it while the dev shell still works.
- **The age gate** (`min-release-age=14` in `.npmrc`) holds for security fixes too, and is
  bypassed only with the author's agreement. `solid-js` is 1.9.17, the version the author's
  sites run, taken past the gate for its seroval fix. `@playwright/test` 1.64.1 was taken
  past it on 2026-10-22, at eight days, with the author's agreement: linlog's nixpkgs
  moved `playwright-driver` to it, and the two must be equal. Install such a version with
  `npm install --package-lock-only --min-release-age=0 PACKAGE@VERSION`, one package alone.
- **Pins that are not "latest" on purpose**: `typescript` stays on 6 (until 7.1 ships an
  API `astro check` can use); `solid-js` stays on 1.x until the port to Solid 2.0;
  `@playwright/test` equals nixpkgs' `playwright-driver` (the `playwright-version` check
  fails, naming the fix, when a bump moves one).
- **`lucide-solid` is checked when the build starts** (`src/integrations/lucide.ts`): the
  version package.json pins, ISC, a `solid` export condition and a peer range of
  `solid-js` the installed Solid meets. A bump of either package that breaks one fails
  `astro build`, naming it.
