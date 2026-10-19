# linlog in the browser

The web front end of [linlog](https://github.com/linlog-prover/linlog), a prover for
linear logic: type a sequent and prove it by clicking, step by step, or let the search
close a goal; see the derivation and, for MLL, the proof net drawn. The prover runs in the
page, as linlog's library compiled to WebAssembly: nothing is installed and nothing is
sent to a server.

## What the page does

- A sequent typed in the field (ASCII such as `A * B |- B * A`, or the signs `⊗ ⅋ ⊸ ⊕ ⊢`),
  proved in classical linear logic or, by the switches on the stage, intuitionistic, with
  Mix or affine weakening; the fragment linlog detects is shown beside it.
- The derivation drawn as linlog draws it, under a camera that zooms and pans; a click on a
  formula of an open goal lists the rules linlog gives for it; a split asks which formulas
  go left and says whether it can still close; a refused step says why, at the goal.
- Undo on the active goal's branch, redo, and a list of every step to go back to; a goal
  closed by linlog's search, or every goal at once, within a work budget; the verdicts
  three-valued (proved and checked, unprovable with the reason and a checked refutation,
  or unknown when the search gave up), and a four-rung hint ladder from the search.
- The finished proof's net (MLL) or essential net (IMLL); every export (SVG, PNG, PDF,
  LaTeX, Typst, text, the session as JSON, the Rocq certificate, and the certificate that
  a refuted goal has no proof); the proof in the link's fragment; every open proof saved
  in the browser and offered back on the next visit; import of a session or a sequent as
  linlog writes them; everything by keyboard (`?` lists the keys); light and dark.

## Building

Everything comes from the Nix flake (flake-parts, `modules/`): `nix develop` (or direnv)
for the dev shell, whose `menu` lists the commands; `nix build` for the site in `result/`;
`nix flake check` for every check (the site's build, Vitest, `astro check`, Biome,
Playwright in Chromium, the formatting and the licence headers). The site is Astro with
one Solid island, TypeScript and Tailwind; linlog's WebAssembly bindings come from
linlog's own flake, a pinned input of this one.

## Licences

The code is licensed under the [EUPL-1.2](LICENSE). The written content (explanations,
tutorials, worked examples and exercises) is licensed under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The fonts are under the SIL
Open Font License 1.1: Euler Math (from linlog), Figtree and Space Mono (from Fontsource).
