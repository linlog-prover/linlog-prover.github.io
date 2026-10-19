---
paths:
  - "src/**"
  - "astro.config.ts"
  - "tsconfig.json"
  - "biome.json"
  - "vitest.config.ts"
  - "playwright.config.ts"
  - "tests/**"
---

# The site's code

Versions are newer than most training data: Astro 7.3, Vite 8, TypeScript 6, Tailwind 4.3,
Solid 1.9, Vitest 5, Playwright 1.63, Biome 2.5 (package-lock.json and linlog's nixpkgs,
2026-10-19). Check an API in `node_modules/<pkg>/**/*.d.ts` before using it from memory.
linlog's own calls are in `.cache/linlog-web/linlog_web.d.ts`, and their documents in
linlog's `plan/web/README.md` ("The bindings' API"); `src/lib/linlog.ts` types the parts
the page reads.

## The worker and the protocol (`src/lib/protocol.ts`, `src/worker/linlog.worker.ts`)

- **linlog's module runs in one module worker**, created as `new Worker(new URL(…,
  import.meta.url), { type: "module" })` in `src/lib/api.ts` (Vite bundles it from that
  pattern alone). The module reads no clock and a call cannot be interrupted, so the one
  cancel is `terminate()` and a fresh worker (`Client.cancel`): every pending call
  rejects with `Cancelled`, and nothing is lost, because the module keeps nothing between
  calls and the page sends every document with every call.
- **Requests carry ids**; answers may come in any order. A call rejects with what it
  threw: linlog's error JSON as a string, which `failure()` reads. The page branches on
  `code`, `kind` and `details.kind` and words the message itself (`src/lib/words.ts`);
  never show `message` raw where a wording exists.
- **A replay is one request** (`replay`, `play` in the worker, over `src/lib/steps.ts`), so
  one `terminate()` stops it.

## The step tree (`src/lib/steps.ts`)

- **The tree is read off the session document**, never kept beside it: `inferences` (a
  goal is the index of its inference, the root 0) and `history` (the goals expanded, in
  order). A link, a file or the browser's storage gives the same tree as a proof made on
  the page.
- **Goals are named by path** (the premise taken at each inference), never by number:
  linlog numbers inferences in the order they are made, so a replay that leaves a step out
  renumbers every later one. Everything stored across a replay (the active goal, a note,
  the hint ladder's key, the redo stack) is a path.
- **Undo per branch** retracts the step that opened the active goal and every step since
  in that step's premises (`retract`), then replays the rest from the sequent. A history
  entry whose premise was expanded without being in the history is a search's graft; it
  replays by `close` again (deterministic: one thread, bounded by work), and a graft that
  no longer closes leaves its goal open and says so. The search's inferences are drawn
  apart (`searchMade`, the class `search` on the drawing's `g#i<n>`, whose rule label is
  the next sibling text: linlog's SVG writes it right after the conclusion).
- **`stepOf` rebuilds a step from its inference**: the principal's position; for two
  premises that split the context (each context formula in exactly one premise), the
  positions in the left premise; a rule that copies the context (`&`) takes no split,
  which linlog refuses. The fast-check property in `steps.test.ts` replays random proof
  attempts against the real module; extend its sequents when a rule is added.

## The drawing and the stage (`src/islands/Stage.tsx`)

- linlog's SVG goes in by `innerHTML`; it stays a picture (`role="img"`, its `<desc>`),
  and every formula of an open goal gets an HTML button over it, placed from the
  element `#i<n>-<p>`'s box (`view.inferences[n]` is the goal `i<n>` draws). The drawing
  is asked with `styles.svg.font_size` 30, so a formula is a 24-pixel target at 100 %.
- Colours come from CSS over the SVG's attributes (`.drawing svg text { fill: … }`), so a
  theme change needs no redraw; the exports keep linlog's own colours.
- The split chooser sits under the goal's row, never beside a formula of it (the
  formulas are what it is clicked on); on a stage under 640 px both popovers are a sheet
  at its bottom.
- Solid's narrowed accessor in `<Show>{(x) => …}` goes stale once its condition is false:
  read it before the handler changes what the condition reads (the restart warning).

## What holds the work

- **The link** (`src/lib/link.ts`): `#v=1&m=<mode>&s=<sequent>&d=<session>` in the fragment,
  the session deflate-raw and base64url, dropped past 2000 characters (the export menu
  says so). A link whose session linlog refuses loads the sequent and the mode, with
  "Proof not restored". The sequent is the field's text with the ASCII connectives as their signs (`pretty`, which `words.test.ts` holds to read as the same sequent).
- **Autosave** (`src/lib/shelf.ts`): every open proof under `linlog-proofs`; at a visit's
  start the last visit's go aside to `linlog-proofs-previous` for the restore bar, so work
  begun before the visitor answers overwrites nothing. Settings are `linlog-settings`,
  the theme `linlog-theme` (read before the first paint by `Base.astro`).

## Styling

- **Every colour, font and size is a token** in `src/styles/tokens.css` (`@theme static`,
  `light-dark()` pairs; Tailwind's palette, fonts and type scale off); `app.css` holds the
  page's one grammar (cluster, label, keyword, hover tip). Never a raw colour outside
  `tokens.css`, never a `style` attribute in markup (the `no-style-attributes` check):
  placement goes through the CSSOM (`el.style.left = …`) in a ref or an effect.
- No `!important` (Biome's rule): reduced motion zeroes the duration tokens instead.

## Tests

- **Vitest** for the logic, beside it as `*.test.ts`; `src/lib/testing.ts` loads linlog's
  real module in Node for the step tree's tests.
- **Playwright**, one test per interaction of the island (`tests/prover.spec.ts`, and
  `tests/phone.spec.ts` at a phone's width), against the built site served as Pages
  serves it (`tests/serve.ts`). Name elements by role and accessible name; a formula's
  button is named `<formula>, formula <p> of goal <g>`.
- In the dev shell, `e2e` drops the host's `LD_LIBRARY_PATH`, which breaks nixpkgs'
  Chromium; a scratch script that launches Chromium needs `env -u LD_LIBRARY_PATH` too.
