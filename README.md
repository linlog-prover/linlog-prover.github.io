# linlog in the browser

The web front end of [linlog](https://github.com/linlog-prover/linlog), a prover for
linear logic: type a sequent and prove it by clicking, step by step, or let the search
close a goal; see the derivation and, for MLL, the proof net drawn. The prover runs in the
page, as linlog's library compiled to WebAssembly: nothing is installed and nothing is
sent to a server.

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
