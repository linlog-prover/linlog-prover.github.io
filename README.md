# linlog in the browser

The web front end of [linlog](https://github.com/linlog-prover/linlog), a prover for
linear logic: type a sequent and prove it by clicking, step by step, or let the search
close a goal; see the derivation and, for MLL, the proof net drawn. The prover runs in the
page, as linlog's library compiled to WebAssembly: nothing is installed and nothing is
sent to a server.

## What the page does

- A sequent typed in the field (ASCII such as `A * B |- B * A`, or the signs `⊗ ⅋ ⊸ ⊕ ⊢`),
  proved in classical linear logic or, by the switches its tab's calculus mark opens,
  intuitionistic, with Mix or affine weakening; the fragment linlog detects is shown beside
  it.
- The derivation drawn as linlog draws it, under a camera that zooms and pans: a pinch of
  two fingers, a trackpad's pinch or ctrl with the wheel zooms the drawing about where it
  happens, one finger or the mouse pans it, and outside the drawing the browser's own zoom
  is left alone; a click on a formula of an open goal lists the rules linlog gives for it; a split asks which formulas
  go left and says whether it can still close; a refused step says why, at the goal.
- A goal opened in a new tab as a proof of its own, and filled back from it (or from any tab
  whose finished proof has its formulas) as one step, named with that tab's sequent and
  checked again in the goal's calculus.
- Undo on the active goal's branch, redo, and a list of every step to go back to; a goal
  closed by linlog's search, or every goal at once, within a work budget; the verdicts
  three-valued (proved and checked, unprovable with the reason and a checked refutation,
  the inverse method's saturated set among them, or unknown when the search gave up), and
  a four-rung hint ladder from the search. Every search names the engine that did its
  work beside that work, with the engine's source in the literature on hover and in
  Learn's reference; Settings can force an engine for the visit, offering those that take
  the sequent.
- The finished proof's net (MLL) or essential net (IMLL); every export (SVG, PNG, PDF,
  LaTeX, Typst, text, the session as JSON, the Rocq certificate, and the certificate that
  a refuted goal has no proof), the drawings set in a math font chosen in the export menu
  (Euler Math, STIX Two Math, Garamond-Math, Asana Math or New Computer Modern Math), by
  default the stage's, which Settings chooses among the same five; the proof in the link's fragment; every open proof saved
  in the browser and offered back on the next visit; import of a session or a sequent as
  linlog writes them; everything by keyboard (`?` lists the keys); a menu, sheet or popover
  closed by Escape or by a press outside it; light and dark, every colour that carries a
  meaning told apart under simulated colour-vision deficiencies and shown with a word, a
  sign or a shape beside it. On a phone every control is at least 44 by 44 pixels, and the
  rarer actions are under More. Each tab keeps its own calculus.
- Learn, a frame around the page with the tutorial's places, practice along the lessons
  (73 sequents, each decided by linlog, provable and unprovable mixed, graded by
  difficulty; each opened as a proof, its answer kept until asked, and a provable one's
  proof watched step by step) and a reference of the connectives and of the engines with
  their literature; a tour of the page that proves a sequent as it goes; About, with every
  licence the site serves.
- After one visit the page works with no network, and it can be installed as an app.
  No cookies, no tracking: GitHub, which serves the site, logs visitors' IP addresses, and
  the privacy page (`/privacy/`) says what that means and what the browser keeps, citing
  the law and the documents it rests on.

## Building

Everything comes from the Nix flake (flake-parts, `modules/`): `nix develop` (or direnv)
for the dev shell, whose `menu` lists the commands; `nix build` for the site in `result/`;
`nix flake check` for every check (the site's build, Vitest, `astro check`, Biome,
Playwright in Chromium, the Content-Security-Policy's hashes, the licences served, the
formatting and the licence headers). The site is Astro with one Solid island, TypeScript
and Tailwind; linlog's WebAssembly bindings come from linlog's own flake, a pinned input
of this one. The written content is Markdown under `src/content/`.

## Hosting

GitHub Pages serves the site at https://linlog-prover.github.io/: every push to `main`
whose checks pass is deployed by the CI workflow. linlog's API documentation at
https://linlog-prover.github.io/linlog/ is linlog's own Pages site, which nothing here
touches, the service worker included. The Content-Security-Policy is a `<meta>` element,
since Pages sets no header.

## Licences

The code is licensed under the [EUPL-1.2](LICENSE). The written content (explanations,
tutorials, worked examples and exercises, under `src/content/`) is licensed under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), as the pages that carry it say.
The fonts are under the SIL Open Font License 1.1: Euler Math, STIX Two Math,
Garamond-Math and Asana Math (from linlog), Figtree and Space Mono (from Fontsource); New
Computer Modern Math (from linlog) is under the GUST Font License, which is the LaTeX
Project Public License 1.3c. Each is served beside its licence under `/fonts/`. The site
serves the notices of the npm packages in its bundle (`/licenses/bundle.txt`) and of the
Rust crates in linlog's module (`/licenses/THIRD-PARTY-NOTICES.txt`).
