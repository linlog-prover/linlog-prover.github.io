# CLAUDE.md

<!--
Maintainer notes (stripped before Claude sees this file).
- Loaded in full every session: only what a session needs before it opens any file.
- What goes where (this file, path-scoped rules, hooks) is .claude/rules/claude-infra.md.
-->

linlog's web front end, to be served at https://linlog-prover.github.io/: a student types a
sequent of linear logic and proves it by clicking, or lets the search close a goal, and
sees the derivation and, for MLL, the net drawn as the command draws them. Nothing is
installed and nothing is sent to a server: the prover runs in the page, as linlog's
WebAssembly module in a module worker.

The prover itself is the repository `linlog-prover/linlog` (locally
`~/Projects/own/linlog`): its crate `linlog-web` is the module and its JavaScript glue,
built by linlog's flake as the package `linlog-web`, which this flake takes through its
pinned input `linlog` and builds no Rust itself. A change the page needs from the library
or the bindings is a change of linlog, made there (in a jj workspace of its own), and
reaches this repository by moving the input. linlog's `plan/web/README.md` is the front
end's plan and `plan/web/design.md` its design (D1 to D60, fixed with the author); the
visual reference is linlog's `plan/web/mockup/`. This repository follows the author's two
sites (`~/Projects/own/website/docs/stack-spec.md`, `~/Projects/own/website-learn`), from
which its flake, its tooling and its Claude Code setup are taken.

## Hard rules

1. **Jujutsu, never git.** The repo is colocated with git only so that nix and GitHub work.
   Every git command, reading ones included, is refused by `.claude/hooks/block-git.py`.
   Commits are signed (jj signs every commit; the global CLAUDE.md says what to do when
   gpg's lock is stale).
2. **Commit thematically, without being asked**: one logical unit per change, committed as
   soon as it is done with `jj commit -m`; never `jj new -m` (a hook blocks it). Run
   `jj st` right before every commit: another session may have committed meanwhile.
   Subjects are short, imperative and capitalised.
3. **Never push, never add a remote, never move a bookmark** unless the author asks in this
   session. Every `gh` command asks first.
4. **Every tool comes from the flake.** The dev shell (direnv, or `nix develop`) has them
   all. npm only resolves `package-lock.json` (`.npmrc`: `package-lock-only`,
   `min-release-age=14`, `ignore-scripts`) and nix builds `node_modules` from it; `npm ci`,
   `npx` and `npm exec` are denied.
5. **Lock files change only through their tools**: `npm install --package-lock-only …` for
   `package-lock.json`, `nix flake lock`/`update` for `flake.lock`; never by hand, never
   `--commit-lock-file` (a raw git commit).
6. **Nix sees only what jj has snapshotted**: run `jj st` after creating a file, before a
   nix command that must see it.
7. **No test, check or tolerance is weakened to make it pass**; a failing check is fixed at
   its cause.

## Commands

- `menu`: the dev shell's commands.
- `dev`: `astro dev` on http://localhost:4321.
- `tests`: Vitest. `lint`: `biome lint`, then `astro check`.
- `e2e`: Playwright against a fresh `astro build`, served as Pages serves it.
- `check`: snapshot, then `nix flake check`: every check CI runs (the header of
  `modules/checks.nix` lists them).
- `nix build`: the site into `result/`. `nix fmt`: treefmt (nixfmt, Biome, shfmt, ruff); a
  hook formats each file written with Write or Edit, a file changed from the shell needs it
  by hand.
- `up`: update the flake inputs and commit `flake.lock` with jj. An update moves every
  ecosystem (npm, the flake inputs, the actions) to its latest release at least fourteen
  days old, verified by `nix flake check` before it is committed, each lock a commit of its
  own; Solid 2.0 waits for the stack specification's two conditions.
- On this machine, builds, tests and Playwright run in a capped scope
  (`systemd-run --user --scope -p MemoryMax=8G -p MemorySwapMax=0 taskset -c … `) on the
  cores the session is given, and `nix flake check` or `nix build` under
  `flock /tmp/linlog-machine.lock`.

## Layout

`flake.nix` declares the inputs; its outputs are one `import-tree` call over `modules/`
(dendritic flake-parts: one concern per file, never an imports list). `astro.config.ts`
and `src/` are the site:
- `src/pages/index.astro`: the one page, the island placed `client:only`, the written
  content rendered into templates; `404.astro` the page Pages serves for a missing path;
  `privacy.astro` the privacy notice, every statement citing its source; `llms.txt.ts`
  the site's `/llms.txt` for AI models (llmstxt.org), its text `src/content/llms.txt`: what
  the page is and the links to linlog's guide for models, which linlog's rustdoc site
  serves at `/linlog/llms.txt` and `/linlog/llms-full.txt`.
- `src/content/`: the written content (CC BY 4.0), Markdown in content collections
  (`src/content.config.ts`): the store of problems with their sessions, Learn's lessons and
  the rules' schemas, the tour, and the texts (About, Practice's and Learn's openings).
- `src/integrations/licences.ts`: the licences written into the build.
- `src/islands/`: the prover, one Solid island (`App.tsx` and its parts).
- `src/worker/linlog.worker.ts`: the module worker that loads linlog's module and answers
  the page's requests.
- `src/lib/`: the client's logic in plain TypeScript, each with its Vitest tests beside it:
  the worker protocol, the step tree and its replay, the link's codec, the stored proofs,
  the theme.
- `src/styles/tokens.css`: every colour, font and size (`@theme static`); `app.css` the
  page's rules.
- `src/logo/`: linlog's logo (CC BY 4.0), the six SVGs every raster is drawn from by the
  flake (`modules/logo.nix`); served at `/logo/`.
- `tests/`: Playwright, one test per interaction of the island; `tests/serve.ts` the static
  server; `tests/fixtures.ts` the `test` every spec imports, failing on a CSP violation.
- `modules/_checks/`: the checks written in Python (`csp.py`, `licences.py`), and
  `modules/_logo/derive.py` the logo's rasters, which import-tree skips.

Each area's conventions are a rule in `.claude/rules/`, which loads when a matching file
is opened with Read, Edit or Write.

## Licences

The code is EUPL-1.2 (`LICENSE`), every source file starting with the licence header in
its comment syntax:

```
// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL
```

(`#` in Nix, shell, Python and YAML; `/* … */` in CSS; inside an Astro component's
frontmatter). The written content (explanations, tutorials, worked examples, exercises) is
CC BY 4.0, as README says, and so is the logo (`src/logo/LICENSE.txt`). No third-party
file is committed: fonts come from npm through
the lock or from linlog's input, never copied in.

## When compacting

Keep: what `@` holds and whether it is described; the brief the session works from and
where in it the work stands; every instruction from the author or a supervising session
that is not yet in a file; what was verified and by what (a killed or partial run is not
a result).
